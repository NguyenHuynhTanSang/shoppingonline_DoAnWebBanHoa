import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CheckoutComponent from './CheckoutComponent';
import OrderSuccessComponent from './OrderSuccessComponent';
import MyOrdersComponent from './MyOrdersComponent';
import API from '../services/api';
import { vietnamToday, deliveryError, DELIVERY_TIME_SLOTS } from '../services/delivery';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>, useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('./MenuComponent', () => () => null);
jest.mock('./InformComponent', () => () => null);
const cardMessage = '<script>alert(1)</script>';
const order = { _id: '111111111111111111111111', status: 'pending', cdate: Date.now(), total: 530000, items: [], customerInfo: { fullName: 'Khách', phone: '0901234567', address: 'Địa chỉ', note: '<script>note</script>', paymentMethod: 'cod' }, deliveryDate: '2099-09-10', deliveryTimeSlot: '08:00-12:00', cardMessage };
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); window.alert = jest.fn();
  // This jsdom version lacks browser Web Crypto; use Node's real CSPRNG in tests.
  Object.defineProperty(window, 'crypto', { configurable: true, value: {
    getRandomValues: values => require('crypto').randomFillSync(values)
  } });
  localStorage.setItem('customerToken', 'test');
  localStorage.setItem('customer', JSON.stringify({ name: 'Khách', phone: '0901234567' }));
});

test('Vietnam date and frontend validation match server constraints', () => {
  expect(vietnamToday(new Date('2026-09-09T17:00:00Z'))).toBe('2026-09-10');
  expect(deliveryError(order)).toBe('');
  for (const patch of [{ deliveryDate: '2000-01-01' }, { deliveryDate: '2099-02-30' }, { deliveryTimeSlot: 'other' }, { cardMessage: 'x'.repeat(301) }]) expect(deliveryError({ ...order, ...patch })).toBeTruthy();
  expect(DELIVERY_TIME_SLOTS).toEqual(['08:00-12:00', '12:00-17:00', '17:00-20:00']);
});

test('checkout sends date/slot/trimmed card separately from note and preserves COD totals', async () => {
  localStorage.setItem('cart', JSON.stringify([{ _id: '222222222222222222222222', name: 'Hoa', image: '/test-flower.png', quantity: 1, price: 500000 }]));
  API.post.mockResolvedValue({ data: { success: true, order } });
  const { container } = render(<CheckoutComponent />);
  fireEvent.change(screen.getByPlaceholderText('Nhập địa chỉ nhận hàng'), { target: { value: 'Địa chỉ' } });
  fireEvent.change(screen.getByLabelText('Ngày giao hoa'), { target: { value: order.deliveryDate } });
  fireEvent.change(screen.getByLabelText('Khung giờ giao mong muốn'), { target: { value: order.deliveryTimeSlot } });
  fireEvent.change(screen.getByLabelText('Lời nhắn thiệp (không bắt buộc)'), { target: { value: ` ${cardMessage} ` } });
  fireEvent.change(screen.getByLabelText('Ghi chú cho shop'), { target: { value: 'Gọi trước' } });
  expect(container.querySelector('script')).toBeNull();
  expect(screen.getByText('530.000 đ')).toBeInTheDocument();
  fireEvent.submit(screen.getByText('Xác nhận đặt hàng').closest('form'));
  await waitFor(() => expect(API.post).toHaveBeenCalledWith('/customer/checkout', expect.objectContaining({ deliveryDate: order.deliveryDate, deliveryTimeSlot: order.deliveryTimeSlot, cardMessage, customerInfo: expect.objectContaining({ note: 'Gọi trước', paymentMethod: 'cod' }) }), expect.any(Object)));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/order-success'));
  expect(API.post.mock.calls[0][1]).not.toHaveProperty('paymentStatus');
  expect(JSON.parse(localStorage.getItem('latestOrder')).deliveryDate).toBe(order.deliveryDate);
});

test('uncertain checkout reuses key; changed intent and confirmed success rotate it; double submit is guarded', async () => {
  localStorage.setItem('cart', JSON.stringify([{ _id: '222222222222222222222222', name: 'Hoa', image: '/test-flower.png', quantity: 1, price: 500000 }]));
  let reject;
  API.post.mockImplementationOnce(() => new Promise((resolve, fail) => { reject = fail; }));
  render(<CheckoutComponent />);
  fireEvent.change(screen.getByPlaceholderText('Nhập địa chỉ nhận hàng'), { target: { value: 'Address A' } });
  fireEvent.change(screen.getByLabelText('Ngày giao hoa'), { target: { value: order.deliveryDate } });
  fireEvent.change(screen.getByLabelText('Khung giờ giao mong muốn'), { target: { value: order.deliveryTimeSlot } });
  const form = screen.getByText('Xác nhận đặt hàng').closest('form');
  fireEvent.submit(form); fireEvent.submit(form);
  expect(API.post).toHaveBeenCalledTimes(1);
  const firstKey = API.post.mock.calls[0][2].headers['Idempotency-Key'];
  expect(firstKey).toMatch(/^[a-f0-9]{32}$/);
  reject(new Error('Synthetic network failure'));
  await waitFor(() => expect(screen.getByText('Xác nhận đặt hàng')).not.toBeDisabled());
  API.post.mockResolvedValueOnce({ data: { success: true } }); // no confirmed order
  fireEvent.submit(form);
  await waitFor(() => expect(API.post).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByText('Xác nhận đặt hàng')).not.toBeDisabled());
  expect(API.post.mock.calls[1][2].headers['Idempotency-Key']).toBe(firstKey);
  expect(mockNavigate).not.toHaveBeenCalledWith('/order-success');
  fireEvent.change(screen.getByPlaceholderText('Nhập địa chỉ nhận hàng'), { target: { value: 'Address B' } });
  API.post.mockResolvedValue({ data: { success: true, order } });
  fireEvent.submit(form);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/order-success'));
  const changedKey = API.post.mock.calls[2][2].headers['Idempotency-Key'];
  expect(changedKey).not.toBe(firstKey);
  fireEvent.submit(form); // navigation is mocked, allowing a new attempt in this mounted component
  await waitFor(() => expect(API.post).toHaveBeenCalledTimes(4));
  expect(API.post.mock.calls[3][2].headers['Idempotency-Key']).not.toBe(changedKey);
});

test.each([true, false])('success/history render safe card and old orders (fields present=%s)', async present => {
  const value = { ...order, paymentStatus: 'Đã thanh toán demo' };
  if (!present) { delete value.deliveryDate; delete value.deliveryTimeSlot; delete value.cardMessage; }
  localStorage.setItem('latestOrder', JSON.stringify(value));
  const success = render(<OrderSuccessComponent />);
  if (present) expect(screen.getByText(cardMessage, { exact: false })).toBeInTheDocument();
  expect(success.container.querySelector('script')).toBeNull();
  success.unmount();
  API.get.mockResolvedValue({ data: { success: true, orders: [value] } });
  const history = render(<MyOrdersComponent />);
  await screen.findByText('Ngày giao hoa');
  expect(screen.getByText('Thanh toán demo - chưa xác minh (dữ liệu cũ)')).toBeInTheDocument();
  expect(value.paymentStatus).toBe('Đã thanh toán demo');
  if (present) expect(screen.getByText(cardMessage, { exact: false })).toBeInTheDocument();
  expect(history.container.querySelector('script')).toBeNull();
});

test.each(['bank', 'momo'])('checkout %s acknowledgement is demo-only and sends no paid status', async method => {
  localStorage.setItem('cart', JSON.stringify([{ _id: '222222222222222222222222', name: 'Hoa', image: '/test-flower.png', quantity: 1, price: 500000 }]));
  API.post.mockResolvedValue({ data: { success: true, order: { ...order, paymentStatus: 'Thanh toán demo - chưa xác minh' } } });
  const { container } = render(<CheckoutComponent />);
  fireEvent.change(screen.getByPlaceholderText('Nhập địa chỉ nhận hàng'), { target: { value: 'Địa chỉ' } });
  fireEvent.change(screen.getByLabelText('Ngày giao hoa'), { target: { value: order.deliveryDate } });
  fireEvent.change(screen.getByLabelText('Khung giờ giao mong muốn'), { target: { value: order.deliveryTimeSlot } });
  fireEvent.click(container.querySelector(`input[value="${method}"]`));
  expect(screen.getByText(/không chứng minh giao dịch thật/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Xác nhận mô phỏng/ }));
  fireEvent.submit(screen.getByText('Xác nhận đặt hàng').closest('form'));
  await waitFor(() => expect(API.post).toHaveBeenCalled());
  expect(API.post.mock.calls[0][1]).not.toHaveProperty('paymentStatus');
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/order-success'));
  expect(JSON.parse(localStorage.getItem('latestOrder')).paymentStatus).toBe('Thanh toán demo - chưa xác minh');
});
test('customer order history shows safe delivery tracking progress and timestamps', async () => {
  const startedAt = 1789701000000;
  const deliveredAt = 1789704600000;

  const trackedOrder = {
    ...order,
    status: 'completed',
    deliveryTracking: {
      startedAt,
      deliveredAt
    }
  };

  API.get.mockResolvedValue({
    data: {
      success: true,
      orders: [trackedOrder]
    }
  });

  render(<MyOrdersComponent />);

  expect(
    await screen.findByText('Tiến trình giao hàng')
  ).toBeInTheDocument();

  expect(
    screen.getAllByText('Đã xác nhận').length
  ).toBeGreaterThan(0);

  expect(
    screen.getAllByText('Đang chuẩn bị').length
  ).toBeGreaterThan(0);

  expect(
    screen.getAllByText('Đang giao hàng').length
  ).toBeGreaterThan(0);

  expect(
    screen.getByText('Giao thành công')
  ).toBeInTheDocument();

  expect(
    screen.getByText('Bắt đầu giao:')
  ).toBeInTheDocument();

  expect(
    screen.getByText('Giao thành công:')
  ).toBeInTheDocument();

  expect(
    screen.getAllByText(
      new Date(startedAt).toLocaleString('vi-VN')
    ).length
  ).toBeGreaterThan(0);

  expect(
    screen.getAllByText(
      new Date(deliveredAt).toLocaleString('vi-VN')
    ).length
  ).toBeGreaterThan(0);
});