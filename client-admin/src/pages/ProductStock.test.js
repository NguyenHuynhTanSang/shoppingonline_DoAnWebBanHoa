import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductAdminComponent from './ProductAdminComponent';
import API from '../services/api';

jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));
jest.mock('../components/LayoutComponent', () => ({ children }) => <div>{children}</div>);

beforeEach(() => {
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  API.get.mockImplementation(async path => ({ data: path === '/admin/products'
    ? { success: true, products: [{ _id: 'flower', name: 'Hoa thử nghiệm', stock: 10, price: 100000 }] }
    : { success: true, categories: [] } }));
  API.put.mockResolvedValue({ data: { success: true } });
});
afterEach(() => jest.restoreAllMocks());

async function setup(action, value) {
  render(<ProductAdminComponent />);
  const row = (await screen.findByText('Hoa thử nghiệm')).closest('tr');
  const input = row.querySelectorAll('input[type="number"]')[action === 'decrease' ? 0 : 1];
  fireEvent.change(input, { target: { value: String(value) } });
  return input;
}

test.each(['decrease', 'set'])('%s cancel preserves input and does not call API', async action => {
  const input = await setup(action, action === 'decrease' ? 3 : 25);
  window.confirm.mockReturnValue(false);
  fireEvent.click(screen.getByText(action === 'decrease' ? '- Trừ' : 'Đặt lại tồn'));
  expect(window.confirm).toHaveBeenCalledWith(action === 'decrease'
    ? 'Sản phẩm: Hoa thử nghiệm\nTồn hiện tại: 10\nTrừ: 3\nTồn dự kiến: 7'
    : 'Sản phẩm: Hoa thử nghiệm\nTồn hiện tại: 10\nĐặt lại thành: 25\nTồn dự kiến: 25');
  expect(API.put).not.toHaveBeenCalled();
  expect(API.get).toHaveBeenCalledTimes(2);
  expect(input).toHaveValue(action === 'decrease' ? 3 : 25);
});

test.each(['decrease', 'set'])('%s confirm preserves payload and success flow', async action => {
  await setup(action, action === 'decrease' ? 3 : 25);
  fireEvent.click(screen.getByText(action === 'decrease' ? '- Trừ' : 'Đặt lại tồn'));
  await waitFor(() => expect(API.get).toHaveBeenCalledTimes(3));
  expect(API.put).toHaveBeenCalledWith('/admin/products/flower/stock', action === 'decrease'
    ? { action: 'decrease', quantity: 3 } : { stock: 25 });
  expect(window.alert).toHaveBeenCalledWith(action === 'decrease' ? 'Cập nhật kho thành công' : 'Đặt lại tồn kho thành công');
});

test('subtract exceeding stock is rejected before confirm', async () => {
  await setup('decrease', 11);
  fireEvent.click(screen.getByText('- Trừ'));
  expect(window.confirm).not.toHaveBeenCalled();
  expect(API.put).not.toHaveBeenCalled();
  expect(window.alert).toHaveBeenCalledWith('Không thể trừ vượt quá tồn kho hiện tại');
});

test.each(['decrease', 'set'])('%s API failure retains error feedback and releases busy', async action => {
  await setup(action, 3);
  API.put.mockRejectedValue({ response: { data: { message: 'Lỗi kiểm thử' } } });
  const button = screen.getByText(action === 'decrease' ? '- Trừ' : 'Đặt lại tồn');
  fireEvent.click(button);
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Lỗi kiểm thử'));
  expect(window.alert).toHaveBeenCalledTimes(1);
  expect(button).not.toBeDisabled();
  expect(API.get).toHaveBeenCalledTimes(2);
});
