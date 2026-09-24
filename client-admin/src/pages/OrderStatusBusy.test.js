import { act, fireEvent, render, screen, within } from '@testing-library/react';
import OrderAdminComponent from './OrderAdminComponent';
import API from '../services/api';

jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));
jest.mock('../components/LayoutComponent', () => ({ children }) => <div>{children}</div>);

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  API.get.mockResolvedValue({ data: { success: true, orders: ['A', 'B'].map(_id => ({
    _id, status: 'pending', items: [], total: 0
  })) } });
});
afterEach(() => jest.restoreAllMocks());

test.each(['success', 'rejection', 'failure response'])('%s clears per-order busy and preserves other order controls', async outcome => {
  let resolve, reject;
  API.put.mockImplementation(() => new Promise((res, rej) => { resolve = res; reject = rej; }));
  render(<OrderAdminComponent />);
  const cardA = (await screen.findByText('Mã đơn: A')).closest('.admin-order-card');
  const cardB = screen.getByText('Mã đơn: B').closest('.admin-order-card');
  fireEvent.click(within(cardA).getByText('Xem chi tiết'));
  const selectA = cardA.querySelector('.admin-order-actions select');
  fireEvent.change(selectA, { target: { value: 'approved' } });
  const buttonA = within(cardA).getByText('Cập nhật trạng thái');
  act(() => { buttonA.click(); buttonA.click(); });
  expect(API.put).toHaveBeenCalledTimes(1);
  expect(API.put).toHaveBeenCalledWith('/admin/orders/A/status', { status: 'approved' });
  expect(selectA).toBeDisabled();
  expect(within(cardA).getByText('Đang cập nhật...')).toBeDisabled();
  fireEvent.click(within(cardB).getByText('Xem chi tiết'));
  expect(cardB.querySelector('.admin-order-actions select')).not.toBeDisabled();
  expect(within(cardB).getByText('Cập nhật trạng thái')).not.toBeDisabled();
  await act(async () => {
    if (outcome === 'rejection') reject(new Error('Synthetic failure'));
    else resolve({ data: { success: outcome === 'success' } });
  });
  const refreshedA = screen.getByText('Mã đơn: A').closest('.admin-order-card');
  fireEvent.click(within(refreshedA).getByText('Xem chi tiết'));
  expect(refreshedA.querySelector('.admin-order-actions select')).not.toBeDisabled();
  expect(within(refreshedA).getByText('Cập nhật trạng thái')).not.toBeDisabled();
  expect(screen.queryByText('Đang cập nhật...')).not.toBeInTheDocument();
});

test('unchanged status validation does not leave the order busy', async () => {
  render(<OrderAdminComponent />);
  const card = (await screen.findByText('Mã đơn: A')).closest('.admin-order-card');
  fireEvent.click(within(card).getByText('Xem chi tiết'));
  fireEvent.click(within(card).getByText('Cập nhật trạng thái'));
  expect(API.put).not.toHaveBeenCalled();
  expect(within(card).getByText('Cập nhật trạng thái')).not.toBeDisabled();
});
