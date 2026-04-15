import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

function LoginAdminComponent() {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!username || !password) {
      setMessage('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    try {
      setLoading(true);

      const res = await API.post('/admin/login', { username, password });

      if (res.data && res.data.success) {
        const token = res.data.token || '';
        const user = res.data.user || {
          username: username,
          role: 'admin'
        };

        localStorage.setItem('adminToken', token);
        localStorage.setItem('token', token);
        localStorage.setItem('adminUser', JSON.stringify(user));
        localStorage.setItem('adminRole', user.role || 'admin');
        localStorage.setItem('admin', JSON.stringify(user));

        navigate('/admin/dashboard');
      } else {
        setMessage(res.data?.message || 'Đăng nhập thất bại');
      }
    } catch (error) {
      console.error(error);

      if (error.response) {
        const apiMessage = error.response?.data?.message || '';

        if (
          error.response.status === 403 ||
          apiMessage === 'Forbidden: insufficient permission'
        ) {
          setMessage('Bạn không có quyền truy cập chức năng này.');
        } else {
          setMessage(apiMessage || 'Lỗi máy chủ');
        }
      } else {
        setMessage('Không thể kết nối tới server');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <form className="admin-login-box" onSubmit={handleLogin}>
        <h1>Đăng nhập hệ thống</h1>

        <input
          type="text"
          placeholder="Tên đăng nhập"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {message && <p className="error-text">{message}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}

export default LoginAdminComponent;