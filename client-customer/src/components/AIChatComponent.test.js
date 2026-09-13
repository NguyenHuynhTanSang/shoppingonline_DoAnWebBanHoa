import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AIChatComponent from './AIChatComponent';
import API from '../services/api';

jest.mock('../services/api', () => ({ __esModule: true, default: { post: jest.fn(), get: jest.fn() } }));
jest.mock('./HumanSupportChat', () => ({ requestId, onResolved }) => <div><p>Đang chờ nhân viên hỗ trợ</p><button onClick={() => onResolved(requestId)}>Resolve event</button></div>);
jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); });

test('restores the conversation ID after refresh and resets it for a new conversation', async () => {
  const id = 'a'.repeat(64);
  sessionStorage.setItem('wf-ai-conversation', JSON.stringify({ id, scope: 'guest' }));
  API.post.mockResolvedValue({ data: { reply: 'Gợi ý mới', products: [], conversationId: id } });
  const input = openChat();
  fireEvent.change(input, { target: { value: 'Có màu hồng không?' } });
  fireEvent.submit(input.closest('form'));
  await screen.findByText('Gợi ý mới');
  expect(API.post).toHaveBeenLastCalledWith('/ai/chat', { message: 'Có màu hồng không?', memory: true, conversationId: id }, expect.any(Object));
  fireEvent.click(screen.getByText('Trò chuyện mới'));
  expect(sessionStorage.getItem('wf-ai-conversation')).toBeNull();
  fireEvent.change(input, { target: { value: 'Tìm hoa' } });
  fireEvent.submit(input.closest('form'));
  await screen.findByText('Gợi ý mới');
  expect(API.post).toHaveBeenLastCalledWith('/ai/chat', { message: 'Tìm hoa', memory: true }, expect.any(Object));
});

test('does not reuse another account conversation ID', async () => {
  sessionStorage.setItem('wf-ai-conversation', JSON.stringify({ id: 'b'.repeat(64), scope: 'customer:another-user' }));
  API.post.mockResolvedValue({ data: { reply: 'Xin chào', products: [] } });
  const input = openChat();
  fireEvent.change(input, { target: { value: 'Tìm hoa' } });
  fireEvent.submit(input.closest('form'));
  await screen.findByText('Xin chào');
  expect(API.post).toHaveBeenLastCalledWith('/ai/chat', { message: 'Tìm hoa', memory: true }, expect.any(Object));
});

test('returns to AI automatically and sends only the new question', async () => {
  localStorage.setItem('customerToken', 'test-token');
  API.get.mockResolvedValue({ data: { request: { id: 'request', status: 'in_progress' } } });
  openChat();
  fireEvent.click(await screen.findByText('Resolve event'));
  expect(screen.getByText(/Nhân viên Wind Flower đã kết thúc phiên hỗ trợ/)).toBeInTheDocument();
  API.post.mockResolvedValue({ data: { reply: 'Hoa phù hợp', products: [] } });
  const input = screen.getByLabelText('Tin nhắn của bạn');
  fireEvent.change(input, { target: { value: 'Tìm hoa dưới 1 triệu' } });
  fireEvent.submit(input.closest('form'));
  await screen.findByText('Hoa phù hợp');
  expect(API.post).toHaveBeenCalledWith('/ai/chat', { message: 'Tìm hoa dưới 1 triệu', memory: true }, expect.any(Object));
});

test('refresh with a resolved request stays in AI mode', async () => {
  localStorage.setItem('customerToken', 'test-token');
  API.get.mockResolvedValue({ data: { request: { id: 'request', status: 'resolved' } } });
  openChat();
  await screen.findByText(/Nhân viên Wind Flower đã kết thúc phiên hỗ trợ/);
  expect(screen.queryByText('Resolve event')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Tin nhắn của bạn')).toBeEnabled();
});

test('continues a handoff with the supplied order ID and clears context after creation', async () => {
  API.post.mockResolvedValueOnce({ data: { reply: 'Vui lòng cung cấp mã đơn', products: [],
    type: 'human_handoff', supportContext: 'Shop giao sai hoa', supportRequestId: null } });
  const input = openChat();
  fireEvent.change(input, { target: { value: 'Shop giao sai hoa' } });
  fireEvent.submit(input.closest('form'));
  await screen.findByText('Vui lòng cung cấp mã đơn');
  expect(screen.getByRole('button', { name: 'Dừng yêu cầu' })).toBeInTheDocument();
  API.post.mockResolvedValueOnce({ data: { reply: 'Đã ghi nhận yêu cầu', products: [],
    type: 'human_handoff', supportRequestId: '333333333333333333333333' } });
  fireEvent.change(input, { target: { value: '222222222222222222222222' } });
  fireEvent.submit(input.closest('form'));
  await screen.findByText('Đang chờ nhân viên hỗ trợ');
  expect(API.post).toHaveBeenLastCalledWith('/ai/chat', {
    message: '222222222222222222222222', memory: true, supportContext: 'Shop giao sai hoa'
  }, expect.any(Object));
  expect(screen.queryByRole('button', { name: 'Dừng yêu cầu' })).not.toBeInTheDocument();
});

function openChat() {
  render(<AIChatComponent />);
  fireEvent.click(screen.getByRole('button', { name: 'Chat với AI' }));
  return screen.getByLabelText('Tin nhắn của bạn');
}

test('blocks whitespace, sends trimmed text and shows safe reply with existing product route', async () => {
  API.post.mockResolvedValue({ data: { reply: '<script>alert(1)</script>', products: [{
    id: '0123456789abcdef01234567', name: 'Hoa hồng', price: 950000, image: '/hoa.png', stock: 5
  }] } });
  const input = openChat();
  fireEvent.change(input, { target: { value: '  ' } });
  expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
  fireEvent.change(input, { target: { value: ' hoa sinh nhật ' } });
  fireEvent.submit(input.closest('form'));
  expect(API.post).toHaveBeenCalledWith('/ai/chat', { message: 'hoa sinh nhật', memory: true }, expect.objectContaining({ timeout: 30000 }));
  expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
  expect(screen.getByRole('link', { name: 'Xem sản phẩm' })).toHaveAttribute('href', '/product/0123456789abcdef01234567');
  fireEvent.click(screen.getByRole('button', { name: 'Đóng chat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Chat với AI' }));
  expect(screen.getByText('hoa sinh nhật')).toBeInTheDocument();
});

test('disables duplicate submission while pending, restores draft on failure', async () => {
  let reject;
  API.post.mockImplementation(() => new Promise((resolve, fail) => { reject = fail; }));
  const input = openChat();
  fireEvent.change(input, { target: { value: 'hoa' } });
  fireEvent.submit(input.closest('form'));
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(input).toBeDisabled();
  fireEvent.submit(input.closest('form'));
  expect(API.post).toHaveBeenCalledTimes(1);
  reject(new Error('unavailable'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Vui lòng thử gửi lại');
  expect(input).toHaveValue('hoa');
  expect(screen.getByRole('button', { name: 'Gửi' })).toBeEnabled();
});

test('handles malformed API responses and supports Escape to minimize', async () => {
  API.post.mockResolvedValue({ data: '<html>not an API</html>' });
  const input = openChat();
  fireEvent.change(input, { target: { value: 'hoa' } });
  fireEvent.submit(input.closest('form'));
  await screen.findByRole('alert');
  fireEvent.keyDown(input, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Wind Flower AI' })).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Chat với AI' })).toHaveFocus();
});
