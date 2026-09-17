import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrderAdminComponent from './OrderAdminComponent';
import API from '../services/api';
jest.mock('../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}));
jest.mock('../components/LayoutComponent', () => ({ children }) => <div>{children}</div>);

test.each([true, false])('admin displays delivery safely and permits old orders (fields present=%s)', async present => {
  localStorage.clear();
  const cardMessage = '<script>alert(1)</script>';
  const order = { _id: '111111111111111111111111', status: 'pending', total: 530000, cdate: Date.now(), items: [], customerInfo: { note: '<script>note</script>', paymentMethod: 'cod' } };
  if (present) Object.assign(order, { deliveryDate: '2026-09-10', deliveryTimeSlot: '08:00-12:00', cardMessage });
  API.get.mockResolvedValue({ data: { success: true, orders: [order] } });
  const { container } = render(<OrderAdminComponent />);
  fireEvent.click(await screen.findByText('Xem chi tiết'));
  expect(screen.getByText('Ngày giao hoa:')).toBeInTheDocument();
  if (present) {
    expect(screen.getByText(/2026-09-10/)).toBeInTheDocument();
    expect(screen.getByText(/08:00-12:00/)).toBeInTheDocument();
    expect(screen.getByText(cardMessage, { exact: false })).toBeInTheDocument();
  }
  expect(container.querySelector('script')).toBeNull();
});

test.each(['Chờ thanh toán khi nhận hàng', 'Đã thanh toán', 'Thanh toán demo - chưa xác minh', 'Đã thanh toán demo'])('admin shows payment status truthfully: %s', async paymentStatus => {
  localStorage.clear();
  API.get.mockResolvedValue({ data: { success: true, orders: [{ _id: 'test', status: 'pending', total: 0, items: [], paymentStatus }] } });
  render(<OrderAdminComponent />);
  fireEvent.click(await screen.findByText('Xem chi tiết'));
  expect(screen.getByText(paymentStatus === 'Đã thanh toán demo' ? /Thanh toán demo - chưa xác minh \(dữ liệu cũ\)/ : new RegExp(paymentStatus))).toBeInTheDocument();
});
const ORDER_ID = '111111111111111111111111';
const STAFF_A_ID = '222222222222222222222222';
const STAFF_B_ID = '333333333333333333333333';

const buildDeliveryOrder = (overrides = {}) => ({
  _id: ORDER_ID,
  status: 'approved',
  total: 530000,
  cdate: Date.now(),
  items: [],
  customerInfo: {
    note: '',
    paymentMethod: 'cod'
  },
  ...overrides
});

test(
  'admin loads active delivery staffs and can assign, reassign and clear assignment',
  async () => {
    localStorage.clear();
    localStorage.setItem('adminRole', 'admin');

    API.get.mockImplementation((path) => {
      if (path === '/admin/orders') {
        return Promise.resolve({
          data: {
            success: true,
            orders: [buildDeliveryOrder()]
          }
        });
      }

      if (path === '/admin/staffs') {
        return Promise.resolve({
          data: {
            success: true,
            staffs: [
              {
                _id: STAFF_A_ID,
                name: 'Staff A',
                active: 1
              },
              {
                _id: STAFF_B_ID,
                name: 'Staff B',
                active: 1
              },
              {
                _id: '444444444444444444444444',
                name: 'Inactive Staff',
                active: 0
              }
            ]
          }
        });
      }

      return Promise.reject(
        new Error(`Unexpected GET ${path}`)
      );
    });

    API.put
      .mockResolvedValueOnce({
        data: {
          success: true,
          order: buildDeliveryOrder({
            delivery: {
              assignedStaff: {
                id: STAFF_A_ID,
                name: 'Staff A'
              },
              assignedAt: Date.now()
            }
          })
        }
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          order: buildDeliveryOrder({
            delivery: {
              assignedStaff: {
                id: STAFF_B_ID,
                name: 'Staff B'
              },
              assignedAt: Date.now()
            }
          })
        }
      });

    API.delete.mockResolvedValue({
      data: {
        success: true,
        order: buildDeliveryOrder()
      }
    });

    jest
      .spyOn(window, 'alert')
      .mockImplementation(() => {});

    jest
      .spyOn(window, 'confirm')
      .mockImplementation(() => true);

    render(<OrderAdminComponent />);

    fireEvent.click(
      await screen.findByText('Xem chi tiết')
    );

    const staffAOption =
      await screen.findByRole('option', {
        name: 'Staff A'
      });

    const deliverySelect =
      staffAOption.parentElement;

    expect(
      screen.getByRole('option', {
        name: 'Staff B'
      })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('option', {
        name: 'Inactive Staff'
      })
    ).not.toBeInTheDocument();

    fireEvent.change(
      deliverySelect,
      {
        target: {
          value: STAFF_A_ID
        }
      }
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Phân công'
      })
    );

    await waitFor(() => {
      expect(API.put).toHaveBeenCalledWith(
        `/admin/orders/${ORDER_ID}/delivery/assignment`,
        {
          staffId: STAFF_A_ID
        }
      );
    });

    expect(
      await screen.findByText('Giao: Staff A')
    ).toBeInTheDocument();

    fireEvent.change(
      deliverySelect,
      {
        target: {
          value: STAFF_B_ID
        }
      }
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Đổi nhân viên'
      })
    );

    await waitFor(() => {
      expect(API.put).toHaveBeenLastCalledWith(
        `/admin/orders/${ORDER_ID}/delivery/assignment`,
        {
          staffId: STAFF_B_ID
        }
      );
    });

    expect(
      await screen.findByText('Giao: Staff B')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Bỏ phân công'
      })
    );

    await waitFor(() => {
      expect(API.delete).toHaveBeenCalledWith(
        `/admin/orders/${ORDER_ID}/delivery/assignment`
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByText('Giao: Staff B')
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByText('Chưa phân công')
    ).toBeInTheDocument();

    window.alert.mockRestore();
    window.confirm.mockRestore();
  }
);

test(
  'staff can see delivery assignment but cannot assign, reassign or clear it',
  async () => {
    localStorage.clear();
    localStorage.setItem('adminRole', 'staff');

    API.get.mockResolvedValue({
      data: {
        success: true,
        orders: [
          buildDeliveryOrder({
            delivery: {
              assignedStaff: {
                id: STAFF_A_ID,
                name: 'Staff A'
              },
              assignedAt: Date.now()
            }
          })
        ]
      }
    });

    render(<OrderAdminComponent />);

    fireEvent.click(
      await screen.findByText('Xem chi tiết')
    );

    expect(
      screen.getByText('Giao: Staff A')
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Chỉ admin được phân công hoặc thay đổi nhân viên giao hàng.'
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Phân công'
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Đổi nhân viên'
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Bỏ phân công'
      })
    ).not.toBeInTheDocument();

    expect(API.get).not.toHaveBeenCalledWith(
      '/admin/staffs'
    );
  }
);
test(
  'assigned staff can start, record failed attempt and complete delivery',
  async () => {
    localStorage.clear();

    localStorage.setItem('adminRole', 'staff');
    localStorage.setItem(
      'adminUser',
      JSON.stringify({
        _id: STAFF_A_ID,
        name: 'Staff A',
        role: 'staff'
      })
    );

    API.get.mockReset();
    API.post.mockReset();
    API.put.mockReset();
    API.delete.mockReset();

    const assignedDelivery = {
      assignedStaff: {
        id: STAFF_A_ID,
        name: 'Staff A'
      },
      assignedAt: Date.now(),
      attempts: []
    };

    API.get.mockResolvedValue({
      data: {
        success: true,
        orders: [
          buildDeliveryOrder({
            status: 'preparing',
            delivery: assignedDelivery
          })
        ]
      }
    });

    API.post
      .mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Đã bắt đầu giao hàng.',
          order: buildDeliveryOrder({
            status: 'delivering',
            delivery: {
              ...assignedDelivery,
              startedAt: Date.now()
            }
          })
        }
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          message:
            'Đã ghi nhận giao hàng chưa thành công.',
          order: buildDeliveryOrder({
            status: 'delivering',
            delivery: {
              ...assignedDelivery,
              startedAt: Date.now(),
              attempts: [
                {
                  result: 'failed',
                  reason: 'customer_unavailable',
                  note: 'Khách chưa nghe máy',
                  attemptedAt: Date.now()
                }
              ]
            }
          })
        }
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Giao hàng thành công.',
          order: buildDeliveryOrder({
            status: 'completed',
            delivery: {
              ...assignedDelivery,
              startedAt: Date.now(),
              deliveredAt: Date.now(),
              attempts: [
                {
                  result: 'failed',
                  reason: 'customer_unavailable',
                  note: 'Khách chưa nghe máy',
                  attemptedAt: Date.now()
                }
              ]
            }
          })
        }
      });

    jest
      .spyOn(window, 'alert')
      .mockImplementation(() => {});

    jest
      .spyOn(window, 'confirm')
      .mockImplementation(() => true);

    try {
      render(<OrderAdminComponent />);

      fireEvent.click(
        await screen.findByText('Xem chi tiết')
      );

      const startButton =
        await screen.findByRole('button', {
          name: 'Bắt đầu giao hàng'
        });

      fireEvent.click(startButton);

      await waitFor(() => {
        expect(API.post).toHaveBeenCalledWith(
          `/admin/orders/${ORDER_ID}/delivery/start`
        );
      });

      const failButton =
        await screen.findByRole('button', {
          name: 'Giao chưa thành công'
        });

      expect(
        screen.getByRole('button', {
          name: 'Hoàn thành giao hàng'
        })
      ).toBeInTheDocument();

      fireEvent.click(failButton);

      const unavailableOption =
        await screen.findByRole('option', {
          name: 'Không liên hệ được khách'
        });

      fireEvent.change(
        unavailableOption.parentElement,
        {
          target: {
            value: 'customer_unavailable'
          }
        }
      );

      fireEvent.change(
        screen.getByPlaceholderText(
          'Ví dụ: Khách chưa nghe máy...'
        ),
        {
          target: {
            value: 'Khách chưa nghe máy'
          }
        }
      );

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Xác nhận giao chưa thành công'
        })
      );

      await waitFor(() => {
        expect(API.post).toHaveBeenNthCalledWith(
          2,
          `/admin/orders/${ORDER_ID}/delivery/fail`,
          {
            reason: 'customer_unavailable',
            note: 'Khách chưa nghe máy'
          }
        );
      });

      expect(
        await screen.findByRole('button', {
          name: 'Giao chưa thành công'
        })
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Hoàn thành giao hàng'
        })
      );

      await waitFor(() => {
        expect(API.post).toHaveBeenNthCalledWith(
          3,
          `/admin/orders/${ORDER_ID}/delivery/complete`
        );
      });

      expect(
        await screen.findByText(
          'Đơn hàng đã được giao thành công.'
        )
      ).toBeInTheDocument();

      expect(API.post).toHaveBeenCalledTimes(3);
    } finally {
      window.alert.mockRestore();
      window.confirm.mockRestore();
    }
  }
);
test(
  'admin displays delivery detail and failed attempt history',
  async () => {
    localStorage.clear();

    localStorage.setItem(
      'adminRole',
      'admin'
    );

    API.get.mockReset();
    API.post.mockReset();
    API.put.mockReset();
    API.delete.mockReset();

    API.get.mockImplementation((url) => {
      if (url === '/admin/staffs') {
        return Promise.resolve({
          data: {
            success: true,
            staffs: []
          }
        });
      }

      return Promise.resolve({
        data: {
          success: true,
          orders: [
            buildDeliveryOrder({
              status: 'delivering',
              delivery: {
                assignedStaff: {
                  id: STAFF_A_ID,
                  name: 'Staff A'
                },
                assignedAt: Date.now(),
                startedAt: Date.now(),
                deliveredAt: null,
                attempts: [
                  {
                    result: 'failed',
                    reason:
                      'customer_unavailable',
                    note:
                      'Khách chưa nghe máy',
                    attemptedAt:
                      Date.now()
                  }
                ]
              }
            })
          ]
        }
      });
    });

    render(<OrderAdminComponent />);

    fireEvent.click(
      await screen.findByText(
        'Xem chi tiết'
      )
    );

    expect(
      await screen.findByText(
        'Chi tiết giao hàng'
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Lịch sử giao chưa thành công'
      )
    ).toBeInTheDocument();

    const deliveryStaffLabel =
  screen.getByText('Nhân viên giao:');

expect(
  deliveryStaffLabel.parentElement
).toHaveTextContent('Staff A');

    expect(
      screen.getByText('Lần 1')
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Không liên hệ được khách'
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Khách chưa nghe máy'
      )
    ).toBeInTheDocument();
  }
);