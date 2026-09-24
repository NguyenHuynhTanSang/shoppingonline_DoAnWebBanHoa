import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginComponent from './LoginComponent';
import RegisterComponent from './RegisterComponent';
import API from '../services/api';
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: { from: '/checkout' } })
}), { virtual: true });
jest.mock('../services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('./MenuComponent', () => () => null);
jest.mock('./InformComponent', () => () => null);
const password = 'TEST_PASSWORD_DO_NOT_LOG';
const token = 'TEST_JWT_DO_NOT_LOG';
beforeEach(() => {
  localStorage.clear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function submit(kind) {
  const { container } = render(kind === 'login' ? <LoginComponent /> : <RegisterComponent />);
  const values = { username: 'customer', password, confirmPassword: password, name: 'Customer', email: 'customer@example.com' };
  container.querySelectorAll('input').forEach(input => {
    fireEvent.change(input, { target: { value: values[input.name] } });
  });
  fireEvent.submit(container.querySelector('form'));
}

test.each([['login', false], ['login', true], ['register', false], ['register', true]])('%s rejection (response=%s) preserves UI without logging credentials', async (kind, hasResponse) => {
  const error = new Error('Synthetic failure');
  error.config = { data: JSON.stringify({ password }), headers: { Authorization: `Bearer ${token}` } };
  if (hasResponse) error.response = { status: 400, data: { message: 'Yêu cầu không hợp lệ.' }, config: error.config };
  API.post.mockRejectedValue(error);
  submit(kind);
  expect(await screen.findByRole('alert')).toHaveTextContent(hasResponse ? 'Yêu cầu không hợp lệ.' : 'Không thể kết nối tới máy chủ.');
  expect(screen.getByRole('button', { name: kind === 'login' ? 'Đăng nhập' : 'Đăng ký', exact: true })).not.toBeDisabled();
  expect(console.error).not.toHaveBeenCalled();
  expect(console.log).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test.each(['login', 'register'])('%s success remains unchanged', async kind => {
  const customer = { name: 'Customer' };
  API.post.mockResolvedValue({ data: { success: true, token, customer, message: 'Đăng ký thành công' } });
  submit(kind);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(kind === 'login' ? '/checkout' : '/login'));
  expect(API.post).toHaveBeenCalledWith(kind === 'login' ? '/customer/login' : '/customer/signup', expect.objectContaining({ username: 'customer', password }));
  if (kind === 'login') {
    expect(localStorage.getItem('customerToken')).toBe(token);
    expect(JSON.parse(localStorage.getItem('customer'))).toEqual(customer);
  } else expect(window.alert).toHaveBeenCalledWith('Đăng ký thành công');
  expect(console.error).not.toHaveBeenCalled();
  expect(console.log).not.toHaveBeenCalled();
});
