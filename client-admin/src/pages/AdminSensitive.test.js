import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StaffAdminComponent from './StaffAdminComponent';
import CustomerAdminComponent from './CustomerAdminComponent';
import API from '../services/api';
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock('../components/LayoutComponent', () => ({ children }) => <div>{children}</div>);
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
const staff = { _id: 'staff-id', username: 'staff-test', name: 'Staff Test', email: 'staff@example.test', active: 1 };
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); localStorage.setItem('adminRole', 'admin');
  window.alert = jest.fn(); window.confirm = jest.fn(() => true);
  API.put.mockResolvedValue({ data: { success: true } });
});

describe('sensitive logging regression', () => {
  let consoleSpies;
  beforeEach(() => {
    consoleSpies = ['error', 'log', 'warn', 'info', 'debug'].map(method =>
      jest.spyOn(console, method).mockImplementation(() => {})
    );
  });
  afterEach(() => {
    consoleSpies.forEach(spy => spy.mockRestore());
  });

  const password = 'TEST_PASSWORD_DO_NOT_LOG';
  const jwt = 'TEST_JWT_DO_NOT_LOG';
  const failedRequest = () => {
    const config = {
      headers: { Authorization: `Bearer ${jwt}` },
      data: JSON.stringify({ password })
    };
    return Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      config,
      response: { status: 500, config, data: { message: 'Server error' } }
    });
  };
  const expectNoLogging = () => {
    // Assert call counts rather than dumping mock arguments on failure.
    for (const spy of consoleSpies) expect(spy.mock.calls.length).toBe(0);
  };

  test.each(['create', 'update'])('STAFF-LOG-01: failed %s handles error without logging credentials', async mode => {
    API.get.mockResolvedValue({ data: { success: true, staffs: [staff] } });
    const request = mode === 'create' ? API.post : API.put;
    request.mockRejectedValueOnce(failedRequest());
    render(<StaffAdminComponent />);
    await screen.findByText('Staff Test');
    if (mode === 'create') {
      fireEvent.click(screen.getByText('+ Thêm nhân viên'));
      fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'new-staff' } });
      fireEvent.change(screen.getByPlaceholderText('Tên nhân viên'), { target: { value: 'New Staff' } });
    } else {
      fireEvent.click(screen.getByText('Sửa'));
    }
    fireEvent.change(screen.getByPlaceholderText(mode === 'create' ? 'Password' : 'Mật khẩu mới (để trống để giữ nguyên)'), { target: { value: password } });
    const submit = screen.getByRole('button', { name: mode === 'create' ? 'Thêm nhân viên' : 'Lưu cập nhật' });
    fireEvent.click(submit);
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Server error'));
    expect(request.mock.calls.length).toBe(1);
    expect(request.mock.calls[0][1].password === password).toBe(true);
    expect(submit).toBeEnabled();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expectNoLogging();
  });

  test.each(['staff', 'customer'])('failed %s list does not log Axios credentials', async account => {
    API.get.mockRejectedValueOnce(failedRequest());
    render(account === 'staff' ? <StaffAdminComponent /> : <CustomerAdminComponent />);
    expect(await screen.findByText('Server error')).toBeInTheDocument();
    expectNoLogging();
  });

  test.each(['staff status', 'staff delete', 'customer status'])('failed %s does not log Axios credentials', async action => {
    API.get.mockResolvedValue({ data: { success: true, staffs: [staff], customers: [staff] } });
    API.put.mockRejectedValueOnce(failedRequest());
    API.delete.mockRejectedValueOnce(failedRequest());
    render(action.startsWith('staff') ? <StaffAdminComponent /> : <CustomerAdminComponent />);
    await screen.findByText('Staff Test');
    if (action === 'customer status') fireEvent.click(screen.getByText('Xem chi tiết'));
    const button = screen.getByRole('button', { name: action === 'staff delete' ? 'Xóa' : action === 'staff status' ? 'Khóa' : 'Khóa tài khoản' });
    fireEvent.click(button);
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Server error'));
    expect(button).toBeEnabled();
    expectNoLogging();
  });
});

test('staff create succeeds and reloads list', async () => {
  API.get.mockResolvedValue({ data: { success: true, staffs: [staff] } });
  API.post.mockResolvedValueOnce({ data: { success: true } });
  render(<StaffAdminComponent />);
  await screen.findByText('Staff Test');
  fireEvent.click(screen.getByText('+ Thêm nhân viên'));
  for (const [placeholder, value] of [['Username', 'new-staff'], ['Tên nhân viên', 'New Staff'], ['Password', 'synthetic-created']]) {
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));
  await waitFor(() => expect(API.get).toHaveBeenCalledTimes(2));
  expect(API.post).toHaveBeenCalledWith('/admin/staff', expect.objectContaining({ username: 'new-staff', name: 'New Staff', password: 'synthetic-created' }));
  expect(screen.queryByPlaceholderText('Password')).not.toBeInTheDocument();
});

test.each(['staff', 'customer'])('%s status succeeds and reloads list', async account => {
  API.get.mockResolvedValue({ data: { success: true, staffs: [staff], customers: [staff] } });
  render(account === 'staff' ? <StaffAdminComponent /> : <CustomerAdminComponent />);
  await screen.findByText('Staff Test');
  if (account === 'customer') fireEvent.click(screen.getByText('Xem chi tiết'));
  fireEvent.click(screen.getByRole('button', { name: account === 'staff' ? 'Khóa' : 'Khóa tài khoản' }));
  await waitFor(() => expect(API.get).toHaveBeenCalledTimes(2));
  expect(API.put).toHaveBeenCalledWith(`/admin/${account === 'staff' ? 'staffs' : 'customers'}/staff-id/status`, { active: account === 'staff' ? 0 : -1 });
});

test.each(['', 'synthetic-new'])('staff edit without existing password; new password=%s', async password => {
  API.get.mockResolvedValue({ data: { success: true, staffs: [staff] } });
  render(<StaffAdminComponent />);
  expect(await screen.findByText('Staff Test')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Sửa'));
  const input = screen.getByPlaceholderText('Mật khẩu mới (để trống để giữ nguyên)');
  expect(input).toHaveValue(''); expect(input).toHaveAttribute('type', 'password');
  fireEvent.change(input, { target: { value: password } });
  fireEvent.click(screen.getByText('Lưu cập nhật'));
  await waitFor(() => expect(API.put).toHaveBeenCalled());
  const [url, payload] = API.put.mock.calls[0];
  expect(url).toBe('/admin/staffs/staff-id'); expect(payload.name).toBe('Staff Test');
  if (password) expect(payload.password).toBe(password); else expect(payload).not.toHaveProperty('password');
  await waitFor(() => expect(API.get).toHaveBeenCalledTimes(2));
});

test('customer list/detail renders business fields but never activation token', async () => {
  API.get.mockResolvedValue({ data: { success: true, customers: [{ ...staff, token: 'synthetic-activation' }] } });
  render(<CustomerAdminComponent />);
  expect(await screen.findByText('Staff Test')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Xem chi tiết'));
  expect(screen.getByText('ID:')).toBeInTheDocument();
  expect(screen.queryByText(/Token kích hoạt/)).not.toBeInTheDocument();
  expect(screen.queryByText('synthetic-activation')).not.toBeInTheDocument();
});
