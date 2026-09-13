import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { DELIVERY_TIME_SLOTS } from '../services/delivery';

// CRA's Jest resolver cannot find the installed react-router-dom main entry.
// Use the actual underlying router exports, preserving real routing in this test.
jest.mock('react-router-dom', () => {
  global.TextEncoder = require('util').TextEncoder;
  global.TextDecoder = require('util').TextDecoder;
  return jest.requireActual('react-router');
}, { virtual: true });
jest.mock('./MenuComponent', () => () => null);
jest.mock('./AIChatComponent', () => () => null);
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/chinh-sach-giao-hang');
});

test('real App route renders current slots, verified fees and explicit policy gaps', () => {
  render(<App />);
  const page = within(screen.getByRole('main'));
  expect(page.getByRole('heading', { level: 1, name: 'Chính sách giao hàng' })).toBeInTheDocument();
  for (const slot of DELIVERY_TIME_SLOTS) expect(page.getByText(slot.replace('-', ' – '))).toBeInTheDocument();
  expect(page.getByText('30.000đ')).toBeInTheDocument();
  expect(page.getByText('Tiền sản phẩm từ 1.500.000đ')).toBeInTheDocument();
  expect(page.getByText(/trước khi trừ voucher/)).toBeInTheDocument();
  expect(page.getByText(/không đồng nghĩa với cam kết giao trong ngày/)).toBeInTheDocument();
  expect(page.getByText(/Phạm vi phục vụ chính.*TP.HCM/)).toBeInTheDocument();
  expect(page.getByText(/có thể phát sinh phí giao lại 30.000đ/)).toBeInTheDocument();
  expect(page.getByText(/Bộ chọn ngày.*chưa tự áp dụng mốc 15:00/)).toBeInTheDocument();
  expect(screen.getByRole('main')).not.toHaveTextContent(/giao toàn quốc|chỉ giao TP.HCM|hoàn tiền|bồi thường/i);
});

test('footer retains Guide and payment links; shipping and contact navigate through App', () => {
  render(<App />);
  const footer = within(screen.getByRole('contentinfo'));
  expect(footer.getByRole('link', { name: 'Hình thức thanh toán' })).toHaveAttribute('href', '/hinh-thuc-thanh-toan');
  fireEvent.click(footer.getByRole('link', { name: 'Hướng dẫn mua hàng' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Hướng dẫn mua hàng' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Chính sách giao hàng' }));
  expect(window.location.pathname).toBe('/chinh-sach-giao-hang');
  fireEvent.click(within(screen.getByRole('main')).getAllByRole('link', { name: 'Liên hệ Wind Flower →' })[0]);
  expect(window.location.pathname).toBe('/lien-he');
  expect(screen.getByRole('heading', { level: 1, name: 'Liên hệ' })).toBeInTheDocument();
});
