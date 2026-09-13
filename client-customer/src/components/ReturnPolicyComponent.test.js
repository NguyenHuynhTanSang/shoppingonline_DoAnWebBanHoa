import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
jest.mock('react-router-dom', () => {
  global.TextEncoder = require('util').TextEncoder;
  global.TextDecoder = require('util').TextDecoder;
  return jest.requireActual('react-router');
}, { virtual: true });
jest.mock('./MenuComponent', () => () => null);
jest.mock('./AIChatComponent', () => () => null);
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/doi-tra-hoan-tien'); });

test('policy maps cancellation to actual UI, separates demo payments and avoids refund promises', () => {
  render(<App />);
  const page = within(screen.getByRole('main'));
  expect(page.getByRole('heading', { level: 1, name: 'Đổi trả, hoàn tiền & thay đổi đơn' })).toBeInTheDocument();
  expect(page.getByText(/nhận sai mẫu, thiếu sản phẩm hoặc hoa bị hư hỏng/)).toBeInTheDocument();
  expect(page.getByText(/có thể dùng nút “Hủy đơn”/)).toHaveTextContent('Chờ xác nhận');
  expect(page.getByText(/website không cho tự hủy ở trạng thái này/)).toHaveTextContent('Đã xác nhận');
  expect(page.getByText(/Website chưa có chức năng để khách tự sửa đơn/)).toBeInTheDocument();
  expect(page.getByText(/Chuyển khoản ngân hàng và MoMo.*demo/)).toBeInTheDocument();
  expect(page.getByText(/AI không tự hủy đơn, hoàn tiền/)).toBeInTheDocument();
  expect(page.getByText(/ảnh sản phẩm theo hướng dẫn của nhân viên/)).toBeInTheDocument();
  expect(screen.getByRole('main')).not.toHaveTextContent(/100%|hoàn trong \d|miễn phí đổi mới|upload ảnh/i);
});

test('footer, contact and shipping links work; redelivery terms agree on both pages', () => {
  render(<App />);
  const phrase = 'Nếu phải giao lại do thông tin sai hoặc không liên hệ được người nhận, có thể phát sinh phí giao lại 30.000đ. Nếu lỗi do Wind Flower, không thu thêm phí giao lại.';
  expect(screen.getByText(phrase)).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('main')).getByRole('link', { name: 'Chính sách giao hàng' }));
  expect(window.location.pathname).toBe('/chinh-sach-giao-hang');
  expect(screen.getByText(phrase)).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Đổi trả, hoàn tiền & thay đổi đơn' }));
  expect(window.location.pathname).toBe('/doi-tra-hoan-tien');
  fireEvent.click(within(screen.getByRole('main')).getAllByRole('link', { name: 'Liên hệ Wind Flower →' })[0]);
  expect(screen.getByRole('heading', { level: 1, name: 'Liên hệ' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Hình thức thanh toán' }));
  expect(screen.getByText(/Chuyển khoản ngân hàng và MoMo tại checkout hiện chỉ là demo/)).toBeInTheDocument();
});
