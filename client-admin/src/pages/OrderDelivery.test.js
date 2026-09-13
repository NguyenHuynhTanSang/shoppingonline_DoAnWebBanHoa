import { fireEvent, render, screen } from '@testing-library/react';
import OrderAdminComponent from './OrderAdminComponent';
import API from '../services/api';
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
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
