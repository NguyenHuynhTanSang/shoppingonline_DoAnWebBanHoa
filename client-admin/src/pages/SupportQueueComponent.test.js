import { act, render, screen, fireEvent } from '@testing-library/react';
import SupportQueueComponent from './SupportQueueComponent';
import API from '../services/api';
jest.mock('../components/LayoutComponent', () => ({ children }) => <div>{children}</div>);
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
beforeEach(() => jest.clearAllMocks());

test('notification refresh reloads queue statistics from API', async () => {
  API.get.mockResolvedValueOnce({ data: { success: true, requests: [], stats: { in_progress: 1, resolved: 0 }, total: 0 } });
  render(<SupportQueueComponent />);
  await screen.findByText('Hiện không có yêu cầu hỗ trợ.');
  API.get.mockResolvedValueOnce({ data: { success: true, requests: [], stats: { in_progress: 0, resolved: 1 }, total: 0 } });
  act(() => window.dispatchEvent(new Event('wf:support-refresh')));
  await screen.findByText('Hiện không có yêu cầu hỗ trợ.');
  expect(screen.getByText('Đang xử lý', { selector: 'span' }).parentElement).toHaveTextContent('0');
  expect(screen.getByText('Đã giải quyết', { selector: 'span' }).parentElement).toHaveTextContent('1');
});

test('resolved filter reloads closed requests without a resolve action', async () => {
  API.get.mockResolvedValue({ data: { success: true, requests: [{ _id: 'closed-request', status: 'resolved', customerId: { name: 'Khách đã hỗ trợ' } }], stats: { resolved: 1 }, total: 1 } });
  render(<SupportQueueComponent />);
  await screen.findByText('Khách đã hỗ trợ');
  fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'resolved' } });
  await screen.findByText('Khách đã hỗ trợ');
  expect(API.get).toHaveBeenLastCalledWith('/admin/support-requests', expect.objectContaining({ params: expect.objectContaining({ status: 'resolved' }) }));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  await screen.findByText('Khách đã hỗ trợ');
  expect(screen.queryByRole('button', { name: 'Đánh dấu đã giải quyết' })).not.toBeInTheDocument();
});
test('lists pending requests, accepts and refreshes', async () => {
  API.get.mockResolvedValue({ data: { success: true, requests: [{ _id: 'request', customerId: { name: 'Khách A' }, status: 'pending', category: 'refund', orderId: 'order-123' }], stats: { total: 1, pending: 1 }, total: 1 } });
  API.patch.mockResolvedValue({ data: { success: true } });
  render(<SupportQueueComponent />);
  expect(await screen.findByText('Khách A')).toBeInTheDocument();
  expect(screen.getByText('order-123')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận' }));
  expect(API.patch).toHaveBeenCalledWith('/admin/support-requests/request/status', { status: 'in_progress' });
  await screen.findByRole('button', { name: 'Tiếp nhận' });
});
test('empty and error states', async () => {
  API.get.mockResolvedValueOnce({ data: { success: true, requests: [], stats: {}, total: 0 } });
  render(<SupportQueueComponent />);
  expect(await screen.findByText('Hiện không có yêu cầu hỗ trợ.')).toBeInTheDocument();
  API.get.mockRejectedValueOnce(new Error('failure'));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được');
});
