import { fireEvent, render, screen } from '@testing-library/react';
import OrderAdminComponent from './OrderAdminComponent';
import API from '../services/api';
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));
jest.mock('../components/LayoutComponent', () => ({ children }) => <div>{children}</div>);

test.each([
  ['pending', ['pending', 'approved', 'canceled']],
  ['approved', ['approved', 'preparing', 'canceled']],
  ['preparing', ['preparing', 'delivering']],
  ['delivering', ['delivering', 'completed']],
  ['completed', ['completed']],
  ['canceled', ['canceled']]
])('status controls reflect permitted transitions from %s', async (status, allowed) => {
  localStorage.clear();
  API.get.mockResolvedValue({ data: { success: true, orders: [{ _id: 'test-order', status, items: [], cdate: Date.now(), total: 0 }] } });
  const { container } = render(<OrderAdminComponent />);
  fireEvent.click(await screen.findByText('Xem chi tiết'));
  const select = container.querySelector('.admin-order-actions select');
  expect([...select.options].filter(option => !option.disabled).map(option => option.value)).toEqual(allowed);
  expect(select.disabled).toBe(['completed', 'canceled'].includes(status));
  expect(screen.getByText('Cập nhật trạng thái').disabled).toBe(['completed', 'canceled'].includes(status));
});
