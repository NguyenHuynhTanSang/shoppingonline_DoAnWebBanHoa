import { act, fireEvent, render, screen } from '@testing-library/react';
import OrderAdminComponent from './OrderAdminComponent';
import API from '../services/api';

jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../components/LayoutComponent', () => ({ children }) => <div>{children}</div>);

const order = { _id: 'test-order', status: 'pending', items: [], cdate: Date.now(), total: 0 };

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test.each(['request', 'response'])('load %s error is inline, and retry restores the list', async failure => {
  if (failure === 'request') API.get.mockRejectedValueOnce(new Error('Network failure'));
  else API.get.mockResolvedValueOnce({ data: { success: false, message: 'Không tải được dữ liệu.' } });
  let resolveRetry;
  API.get.mockImplementationOnce(() => new Promise(resolve => { resolveRetry = resolve; }));
  render(<OrderAdminComponent />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải đơn hàng');
  expect(screen.queryByText('Chưa có đơn hàng.')).not.toBeInTheDocument();
  expect(screen.queryByText('Không có đơn hàng phù hợp bộ lọc.')).not.toBeInTheDocument();
  expect(window.alert).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(screen.getByText('Đang tải đơn hàng...')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await act(async () => resolveRetry({ data: { success: true, orders: [order] } }));
  expect(screen.getByText('Xem chi tiết')).toBeInTheDocument();
  expect(API.get).toHaveBeenCalledTimes(2);
  expect(API.get).toHaveBeenLastCalledWith('/admin/orders');
});

test('successful empty response shows the true empty state', async () => {
  API.get.mockResolvedValue({ data: { success: true, orders: [] } });
  render(<OrderAdminComponent />);
  expect(await screen.findByText('Chưa có đơn hàng.')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('search with no matches preserves filtered-empty behavior', async () => {
  API.get.mockResolvedValue({ data: { success: true, orders: [order] } });
  render(<OrderAdminComponent />);
  await screen.findByText('Xem chi tiết');
  fireEvent.change(screen.getByPlaceholderText('Tìm theo mã đơn, tên khách, số điện thoại, email...'), { target: { value: 'no-match' } });
  expect(screen.getByText('Không có đơn hàng phù hợp bộ lọc.')).toBeInTheDocument();
  expect(screen.queryByText('Chưa có đơn hàng.')).not.toBeInTheDocument();
});
