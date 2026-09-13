import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LayoutComponent from './LayoutComponent';
import API from '../services/api';
import { io } from 'socket.io-client';
jest.mock('../services/api', () => ({ __esModule: true, API_BASE: '', default: { get: jest.fn() } }));
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('./HeaderComponent', () => () => <header>Admin</header>);
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: '/dashboard' })
}), { virtual: true });

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

test('initial count, new notification dedup, transitions, reconnect and listener cleanup', async () => {
  localStorage.setItem('adminToken', 'synthetic-token');
  localStorage.setItem('adminRole', 'admin');
  const handlers = {};
  const socket = { on: jest.fn((event, handler) => { handlers[event] = handler; }), off: jest.fn(), disconnect: jest.fn() };
  io.mockReturnValue(socket);
  let pending = 3;
  API.get.mockImplementation(async () => ({ data: { success: true, stats: { pending } } }));
  const { rerender, unmount } = render(<LayoutComponent><p>Dashboard</p></LayoutComponent>);
  expect(await screen.findByLabelText('3 yêu cầu đang chờ')).toHaveTextContent('3');
  expect(API.get).toHaveBeenCalledWith('/admin/support-requests', expect.objectContaining({ params: { status: 'pending', page: 1 } }));
  pending = 4;
  await act(async () => handlers['support:new']({ supportRequestId: 'request-1', status: 'pending' }));
  expect(await screen.findByLabelText('4 yêu cầu đang chờ')).toBeInTheDocument();
  expect(screen.getAllByText('Có yêu cầu hỗ trợ mới')).toHaveLength(1);
  expect(screen.getByText('Xem yêu cầu')).toHaveAttribute('href', '/support-requests');
  fireEvent.click(screen.getByLabelText('Đóng thông báo hỗ trợ'));
  await act(async () => handlers['support:new']({ supportRequestId: 'request-1', status: 'pending' }));
  expect(screen.queryByText('Có yêu cầu hỗ trợ mới')).not.toBeInTheDocument();
  pending = 0;
  await act(async () => handlers['support:updated']({ status: 'in_progress' }));
  expect(screen.queryByLabelText('4 yêu cầu đang chờ')).not.toBeInTheDocument();
  await act(async () => handlers['support:updated']({ status: 'resolved' }));
  pending = 7;
  await act(async () => handlers.connect());
  expect(await screen.findByLabelText('7 yêu cầu đang chờ')).toBeInTheDocument();
  rerender(<LayoutComponent><p>Other page</p></LayoutComponent>);
  expect(io).toHaveBeenCalledTimes(1);
  expect(socket.on).toHaveBeenCalledTimes(3);
  unmount();
  expect(socket.off).toHaveBeenCalledTimes(3);
  expect(socket.disconnect).toHaveBeenCalledTimes(1);
});

test('an event during an older count request triggers another API read', async () => {
  localStorage.setItem('adminToken', 'synthetic-token'); localStorage.setItem('adminRole', 'staff');
  const handlers = {};
  io.mockReturnValue({ on: (event, fn) => { handlers[event] = fn; }, off: jest.fn(), disconnect: jest.fn() });
  let complete;
  API.get.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
    .mockResolvedValue({ data: { success: true, stats: { pending: 2 } } });
  render(<LayoutComponent />);
  act(() => handlers['support:new']({ supportRequestId: 'request-2', status: 'pending' }));
  await act(async () => complete({ data: { success: true, stats: { pending: 1 } } }));
  await waitFor(() => expect(screen.getByLabelText('2 yêu cầu đang chờ')).toBeInTheDocument());
  expect(API.get).toHaveBeenCalledTimes(2);
});
