import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import HumanSupportChat from './HumanSupportChat';
import API from '../services/api';
import { io } from 'socket.io-client';
jest.mock('../services/api', () => ({ __esModule: true, API_BASE: '', default: { get: jest.fn() } }));
jest.mock('socket.io-client', () => ({ io: jest.fn() }));

test('recovers a missed resolved event by polling and returns once with cleanup', async () => {
  jest.useFakeTimers();
  const handlers = {};
  const socket = { on: jest.fn((event, callback) => { handlers[event] = callback; }), disconnect: jest.fn() };
  io.mockReturnValue(socket);
  API.get.mockResolvedValue({ data: { request: { status: 'resolved' } } });
  const resolved = jest.fn();
  const { unmount } = render(<HumanSupportChat requestId="closed-request" onResolved={resolved} />);
  await act(async () => { jest.advanceTimersByTime(10000); });
  expect(API.get).toHaveBeenCalledWith('/support-chat/closed-request/status', { timeout: 10000 });
  expect(resolved).toHaveBeenCalledWith('closed-request');
  act(() => handlers['support:status']({ id: 'closed-request', status: 'resolved' }));
  expect(resolved).toHaveBeenCalledTimes(1);
  expect(socket.disconnect).toHaveBeenCalled();
  unmount();
  const calls = API.get.mock.calls.length;
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(API.get).toHaveBeenCalledTimes(calls);
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('loads text history, sends human messages, reconnects and blocks resolved sends', async () => {
  const handlers = {};
  const socket = { connected: true, on: jest.fn((event, handler) => { handlers[event] = handler; }), disconnect: jest.fn(), connect: jest.fn(), timeout: jest.fn() };
  socket.timeout.mockReturnValue(socket);
  socket.emit = jest.fn((event, payload, callback) => {
    if (event === 'support:join') callback(null, { ok: true, request: { status: 'in_progress' } });
    else callback(null, { ok: true, message: { _id: '2', senderType: 'customer', message: payload.message, sequence: 2, createdAt: new Date().toISOString() } });
  });
  io.mockReturnValue(socket);
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => 'test-message-uuid' } });
  API.get.mockResolvedValue({ data: { request: { status: 'in_progress' }, messages: [{ _id: '1', senderType: 'staff', message: '<script>alert(1)</script>', sequence: 1, createdAt: new Date().toISOString() }], hasMore: false } });
  render(<HumanSupportChat requestId="request-id" />);
  await act(async () => { handlers.connect(); });
  expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
  const input = screen.getByLabelText('Tin nhắn hỗ trợ');
  expect(input).toBeEnabled();
  fireEvent.change(input, { target: { value: 'Xin chào nhân viên' } });
  fireEvent.submit(input.closest('form'));
  expect(await screen.findByText('Xin chào nhân viên')).toBeInTheDocument();
  expect(socket.emit).toHaveBeenCalledWith('support:message', expect.objectContaining({ supportRequestId: 'request-id', clientMessageId: 'test-message-uuid' }), expect.any(Function));
  act(() => handlers.disconnect()); expect(input).toBeDisabled();
  await act(async () => { handlers.connect(); });
  await waitFor(() => expect(input).toBeEnabled());
  expect(API.get).toHaveBeenCalledTimes(2);
  act(() => handlers['support:status']({ id: 'request-id', status: 'resolved' }));
  expect(screen.getByText('Phiên hỗ trợ đã kết thúc.')).toBeInTheDocument();
  expect(input).toBeDisabled();
});
