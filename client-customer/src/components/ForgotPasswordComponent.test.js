import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ForgotPasswordComponent from './ForgotPasswordComponent';
import API from '../services/api';

jest.mock('../services/api', () => ({ post: jest.fn() }));
jest.mock('./MenuComponent', () => () => null);
jest.mock('./InformComponent', () => () => null);
jest.mock('react-router-dom', () => ({ Link: ({ to, children }) => <a href={to}>{children}</a> }), { virtual: true });

test.each([false, true])('forgot ignores reset link in response, failure=%s', async failure => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const getter = jest.fn(() => 'https://example.test/reset-password?token=SYNTHETIC');
  const data = { success: true, message: failure ? 'Vui lòng thử lại sau.' : 'Nếu email tồn tại, bạn sẽ nhận hướng dẫn qua email.' };
  Object.defineProperty(data, 'resetLink', { get: getter });
  API.post.mockReset();
  if (failure) API.post.mockRejectedValueOnce({ response: { data }, config: { headers: { Authorization: 'SYNTHETIC_JWT' } } });
  else API.post.mockResolvedValueOnce({ data });
  try {
    render(<ForgotPasswordComponent />);
    fireEvent.change(screen.getByPlaceholderText('Nhập email của bạn'), { target: { value: 'test@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() => expect(screen.getByText(data.message)).toHaveTextContent(data.message));
    expect(getter).not.toHaveBeenCalled();
    expect(document.querySelector('a[href*="token="]')).toBeNull();
    expect(screen.queryByText('Sao chép link')).not.toBeInTheDocument();
    expect(errorSpy.mock.calls.length).toBe(0);
    expect(logSpy.mock.calls.length).toBe(0);
    expect(screen.getByRole('button', { name: 'Gửi yêu cầu' })).toBeEnabled();
  } finally { errorSpy.mockRestore(); logSpy.mockRestore(); }
});
