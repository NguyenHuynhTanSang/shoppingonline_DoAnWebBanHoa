import { fireEvent, render, screen } from '@testing-library/react';
import CheckoutComponent from './CheckoutComponent';
import API from '../services/api';
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ Link: ({ to, children }) => <a href={to}>{children}</a>, useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('./MenuComponent', () => () => null);
jest.mock('./InformComponent', () => () => null);
const item = { _id: '222222222222222222222222', name: 'Flower', image: '/test.png', quantity: 1, price: 500000 };
beforeEach(() => {
  localStorage.clear();
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  localStorage.setItem('customerToken', 'synthetic-token');
  localStorage.setItem('customer', JSON.stringify({ name: 'Customer', phone: '0901234567' }));
  localStorage.setItem('cart', JSON.stringify([item]));
});
afterEach(() => jest.restoreAllMocks());

test.each([null, 'null', '{bad', '{}', '42', '[null]', '[[]]', '[{}]', JSON.stringify([{ ...item, name: {} }]), JSON.stringify([{ ...item, price: {} }])])('invalid cart %s cannot submit', raw => {
  if (raw === null) localStorage.removeItem('cart');
  else localStorage.setItem('cart', raw);
  render(<CheckoutComponent />);
  expect(mockNavigate).toHaveBeenCalledWith('/cart');
  fireEvent.change(screen.getByPlaceholderText('Nhập địa chỉ nhận hàng'), { target: { value: 'Address' } });
  fireEvent.submit(screen.getByText('Xác nhận đặt hàng').closest('form'));
  expect(API.post).not.toHaveBeenCalled();
  expect(localStorage.getItem('cart')).toBe(raw);
});

test.each([null, 'null', '{bad', '[]', 'true', '{}', '{"name":{}}', '{"name":"Customer","phone":123}'])('invalid customer %s follows login handling without crash', raw => {
  if (raw === null) localStorage.removeItem('customer');
  else localStorage.setItem('customer', raw);
  render(<CheckoutComponent />);
  expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { from: '/checkout' } });
  expect(localStorage.getItem('customer')).toBe(raw);
  fireEvent.submit(screen.getByText('Xác nhận đặt hàng').closest('form'));
  expect(API.post).not.toHaveBeenCalled();
});

test('submit safely rechecks customer changed after mount', () => {
  render(<CheckoutComponent />);
  localStorage.setItem('customer', '{bad');
  fireEvent.submit(screen.getByText('Xác nhận đặt hàng').closest('form'));
  expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { from: '/checkout' } });
  expect(API.post).not.toHaveBeenCalled();
  expect(localStorage.getItem('cart')).toBe(JSON.stringify([item]));
});
