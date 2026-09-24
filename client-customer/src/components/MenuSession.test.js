import { act, render } from '@testing-library/react';
import MenuComponent from './MenuComponent';
import API from '../services/api';
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mockNavigate
}), { virtual: true });
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
let requests;
beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  localStorage.setItem('customerToken', 'synthetic-token');
  localStorage.setItem('cart', '[]');
  requests = [];
  API.get.mockImplementation(path => path === '/customer/session'
    ? new Promise((resolve, reject) => requests.push({ resolve, reject }))
    : Promise.resolve({ data: { success: true, categories: [] } }));
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const success = name => ({ data: { success: true, customer: { name } } });

test.each(['success', 'error'])('stale %s cannot overwrite latest valid session', async type => {
  render(<MenuComponent />);
  await act(async () => window.dispatchEvent(new Event('focus')));
  await act(async () => requests[1].resolve(success('Latest')));
  await act(async () => type === 'success'
    ? requests[0].resolve(success('Old'))
    : requests[0].reject({ response: { status: 401 } }));
  expect(JSON.parse(localStorage.getItem('customer')).name).toBe('Latest');
  expect(localStorage.getItem('customerToken')).toBe('synthetic-token');
  expect(mockNavigate).not.toHaveBeenCalled();
});

test.each([[401, 'INVALID_TOKEN'], [403, 'ACCOUNT_LOCKED'], [403, 'ACCOUNT_INACTIVE']])('latest %s/%s logs out and stale success cannot restore session', async (status, code) => {
  render(<MenuComponent />);
  await act(async () => jest.advanceTimersByTime(10000));
  expect(requests).toHaveLength(2);
  await act(async () => requests[1].reject({ response: { status, data: { code } } }));
  await act(async () => requests[0].resolve(success('Old')));
  expect(localStorage.getItem('customerToken')).toBeNull();
  expect(localStorage.getItem('customer')).toBeNull();
  expect(localStorage.getItem('cart')).toBe('[]');
  expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  expect(window.alert).toHaveBeenCalledTimes(1);
});

test.each(['success', 'error'])('unmount ignores pending %s and removes polling/focus', async type => {
  const { unmount } = render(<MenuComponent />);
  unmount();
  await act(async () => type === 'success'
    ? requests[0].resolve(success('Old'))
    : requests[0].reject({ response: { status: 401 } }));
  act(() => { jest.advanceTimersByTime(20000); window.dispatchEvent(new Event('focus')); });
  expect(requests).toHaveLength(1);
  expect(localStorage.getItem('customer')).toBeNull();
  expect(localStorage.getItem('customerToken')).toBe('synthetic-token');
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('response for a replaced token is ignored without another request', async () => {
  render(<MenuComponent />);
  localStorage.setItem('customerToken', 'replacement-token');
  await act(async () => requests[0].reject({ response: { status: 401 } }));
  expect(localStorage.getItem('customerToken')).toBe('replacement-token');
  expect(mockNavigate).not.toHaveBeenCalled();
});
