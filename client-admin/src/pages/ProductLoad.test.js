import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductAdminComponent from './ProductAdminComponent';
import API from '../services/api';
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn() } }));
jest.mock('../components/LayoutComponent', () => ({ children }) => <div>{children}</div>);
const products = [{ _id: 'flower', name: 'Test flower', stock: 10, price: 100000 }];
const categories = [{ _id: 'cat', name: 'Test category', submenus: [] }];
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test.each(['reject', 'response'])('Product %s error is not empty and retry only fetches products', async mode => {
  let failed = true;
  API.get.mockImplementation(async path => {
    if (path === '/admin/categories') return { data: { success: true, categories } };
    if (failed && mode === 'reject') throw new Error('Synthetic failure');
    return { data: { success: !failed, products } };
  });
  render(<ProductAdminComponent />);
  await screen.findByText('Không thể tải sản phẩm');
  expect(screen.queryByText('Chưa có sản phẩm')).not.toBeInTheDocument();
  failed = false;
  fireEvent.click(screen.getByText('Thử lại sản phẩm'));
  await screen.findByText('Test flower');
  expect(API.get.mock.calls.filter(([path]) => path === '/admin/categories')).toHaveLength(1);
});

test.each([[[]], [products]])('successful list distinguishes true empty and filtered empty', async list => {
  API.get.mockImplementation(async path => ({ data: { success: true, products: list, categories } }));
  const { container } = render(<ProductAdminComponent />);
  if (!list.length) expect(await screen.findByText('Chưa có sản phẩm')).toBeInTheDocument();
  else {
    await screen.findByText('Test flower');
    fireEvent.change(container.querySelector('input[type="text"]'), { target: { value: 'no-match-xyz' } });
    expect(screen.getByText('Không có sản phẩm phù hợp bộ lọc/tìm kiếm')).toBeInTheDocument();
  }
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each(['reject', 'response'])('Category %s failure blocks dependent controls and retry restores them', async mode => {
  let failed = true;
  API.get.mockImplementation(async path => {
    if (path === '/admin/products') return { data: { success: true, products } };
    if (failed && mode === 'reject') throw new Error('Synthetic failure');
    return { data: { success: !failed, categories } };
  });
  const { container } = render(<ProductAdminComponent />);
  await screen.findByRole('heading', { name: 'Không thể tải danh mục' });
  expect(screen.getByText('Test flower')).toBeInTheDocument();
  expect(screen.getByText('Lưu phân loại')).toBeDisabled();
  expect(screen.getByText('- Trừ')).not.toBeDisabled();
  fireEvent.click(screen.getByText('+ Thêm sản phẩm'));
  const form = container.querySelector('form');
  expect(form.querySelector('select')).toBeDisabled();
  expect(form.querySelector('button[type="submit"]')).toBeDisabled();
  fireEvent.submit(form);
  expect(API.post).not.toHaveBeenCalled();
  failed = false;
  fireEvent.click(screen.getByText('Thử lại danh mục'));
  await waitFor(() => expect(form.querySelector('select')).not.toBeDisabled());
  expect(form.querySelector('button[type="submit"]')).not.toBeDisabled();
  expect(screen.getByText('Lưu phân loại')).not.toBeDisabled();
  expect(API.get.mock.calls.filter(([path]) => path === '/admin/products')).toHaveLength(1);
});
