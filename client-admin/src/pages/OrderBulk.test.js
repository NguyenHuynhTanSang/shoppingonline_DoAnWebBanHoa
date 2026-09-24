import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrderAdminComponent from './OrderAdminComponent';
import API from '../services/api';

jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));
jest.mock('../components/LayoutComponent', () => ({ children }) => <div>{children}</div>);

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  API.get.mockResolvedValue({ data: { success: true, orders: ['A', 'B', 'C', 'D', 'E'].map(_id => ({
    _id, status: 'pending', items: [], total: 0
  })) } });
});
afterEach(() => jest.restoreAllMocks());

test.each([5, 4, 0])('%i successes are counted, selection retained only for failures and list reloaded', async count => {
  let index = 0;
  API.put.mockImplementation(() => {
    const current = index++;
    if (current < count) return Promise.resolve({ data: { success: true } });
    return current % 2 ? Promise.reject(new Error('Synthetic failure')) : Promise.resolve({ data: { success: false } });
  });
  render(<OrderAdminComponent />);
  await screen.findByText('Mã đơn: A');
  fireEvent.click(screen.getByLabelText('Chọn tất cả đơn đang lọc'));
  fireEvent.click(screen.getByText('Cập nhật hàng loạt'));
  await waitFor(() => expect(API.get).toHaveBeenCalledTimes(2));
  await screen.findByText('Mã đơn: A');
  expect(API.put).toHaveBeenCalledTimes(5);
  ['A', 'B', 'C', 'D', 'E'].forEach((id, i) => {
    expect(API.put).toHaveBeenCalledWith(`/admin/orders/${id}/status`, { status: 'approved' });
    const card = screen.getByText(`Mã đơn: ${id}`).closest('.admin-order-card');
    expect(card.querySelector('input[type="checkbox"]').checked).toBe(i >= count);
  });
  expect(window.alert).toHaveBeenCalledWith(count === 5
    ? 'Cập nhật trạng thái hàng loạt thành công!'
    : count === 0 ? 'Không cập nhật được 5 đơn hàng. Vui lòng kiểm tra và thử lại.'
      : 'Đã cập nhật 4/5 đơn hàng. 1 đơn không cập nhật được.');
});

test('early rejection still waits for remaining requests before feedback and reload', async () => {
  let finish;
  API.put.mockRejectedValueOnce(new Error('Synthetic failure'))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue({ data: { success: true } });
  render(<OrderAdminComponent />);
  await screen.findByText('Mã đơn: A');
  fireEvent.click(screen.getByLabelText('Chọn tất cả đơn đang lọc'));
  await act(async () => fireEvent.click(screen.getByText('Cập nhật hàng loạt')));
  expect(API.get).toHaveBeenCalledTimes(1);
  expect(window.alert).not.toHaveBeenCalled();
  await act(async () => finish({ data: { success: true } }));
  expect(API.get).toHaveBeenCalledTimes(2);
  expect(API.put).toHaveBeenCalledTimes(5);
  expect(window.alert).toHaveBeenCalledWith('Đã cập nhật 4/5 đơn hàng. 1 đơn không cập nhật được.');
});

test('no selection and canceled confirmation do not start a batch', async () => {
  render(<OrderAdminComponent />);
  await screen.findByText('Mã đơn: A');
  fireEvent.click(screen.getByText('Cập nhật hàng loạt'));
  expect(window.alert).toHaveBeenCalledWith('Vui lòng chọn ít nhất 1 đơn hàng.');
  fireEvent.click(screen.getByLabelText('Chọn tất cả đơn đang lọc'));
  window.confirm.mockReturnValue(false);
  fireEvent.click(screen.getByText('Cập nhật hàng loạt'));
  expect(API.put).not.toHaveBeenCalled();
  expect(API.get).toHaveBeenCalledTimes(1);
});
