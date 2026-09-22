import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HeaderComponent from '../components/HeaderComponent';
import LoginAdminComponent from '../pages/LoginAdminComponent';
import API from './api';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('axios', () => ({ create: jest.fn(() => ({
  post: jest.fn(),
  interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }
})) }));

const sessionKeys = ['adminToken', 'token', 'admin', 'adminUser', 'adminRole'];
const preservedKeys = ['customerToken', 'customer', 'cart', 'cartDiscount', 'cartVoucherCode', 'cartVoucherInfo', 'adminOrderCustomerKeyword'];
const originalLocation = window.location;
let redirect;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionKeys.forEach(key => localStorage.setItem(key, 'stale'));
  preservedKeys.forEach(key => localStorage.setItem(key, 'preserved'));
  redirect = jest.fn();
  delete window.location;
  window.location = { set href(value) { redirect(value); } };
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  window.location = originalLocation;
  jest.restoreAllMocks();
});

function expectCleanup() {
  sessionKeys.forEach(key => expect(localStorage.getItem(key)).toBeNull());
  preservedKeys.forEach(key => expect(localStorage.getItem(key)).toBe('preserved'));
}

function freshErrorHandler() {
  let handler;
  jest.isolateModules(() => {
    require('axios').create.mockImplementation(() => ({
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }
    }));
    const api = require('./api').default;
    handler = api.interceptors.response.use.mock.calls[0][1];
  });
  return handler;
}

test('concurrent 401 responses clean admin session and notify/redirect only once; reload resets guard', async () => {
  const handler = freshErrorHandler();
  const errors = [1, 2, 3].map(() => ({ response: { status: 401 } }));
  const results = await Promise.allSettled(errors.map(handler));
  results.forEach((result, index) => {
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe(errors[index]);
  });
  expectCleanup();
  expect(window.alert).toHaveBeenCalledTimes(1);
  expect(redirect).toHaveBeenCalledTimes(1);
  expect(redirect).toHaveBeenCalledWith('/admin/login');
  await expect(freshErrorHandler()(errors[0])).rejects.toBe(errors[0]);
  expect(redirect).toHaveBeenCalledTimes(2);
});

test('ordinary non-401 errors remain rejected without cleanup or redirect', async () => {
  const handler = freshErrorHandler();
  for (const status of [403, 500]) {
    const error = { response: { status, data: { message: 'Other error' } } };
    await expect(handler(error)).rejects.toBe(error);
  }
  expect(window.alert).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
  expect(localStorage.getItem('adminToken')).toBe('stale');
});

test('Header tolerates malformed storage and logout clears only admin session', () => {
  render(<HeaderComponent />);
  expect(screen.getByText('Xin chào, Admin')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  expectCleanup();
  expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
});

test('Header tolerates null storage', () => {
  localStorage.setItem('admin', 'null');
  render(<HeaderComponent />);
  expect(screen.getByText('Xin chào, Admin')).toBeInTheDocument();
});

test('successful login still writes all five session keys and navigates to dashboard', async () => {
  const api = API;
  const user = { username: 'test-admin', role: 'admin' };
  api.post.mockResolvedValue({ data: { success: true, token: 'synthetic-token', user } });
  const { container } = render(<LoginAdminComponent />);
  fireEvent.change(container.querySelector('input[type="text"]'), { target: { value: 'test-admin' } });
  fireEvent.change(container.querySelector('input[type="password"]'), { target: { value: 'synthetic-password' } });
  fireEvent.submit(container.querySelector('form'));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  expect(localStorage.getItem('adminToken')).toBe('synthetic-token');
  expect(localStorage.getItem('token')).toBe('synthetic-token');
  expect(localStorage.getItem('admin')).toBe(JSON.stringify(user));
  expect(localStorage.getItem('adminUser')).toBe(JSON.stringify(user));
  expect(localStorage.getItem('adminRole')).toBe('admin');
});
