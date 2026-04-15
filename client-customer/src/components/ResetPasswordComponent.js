import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import API from '../services/api';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function ResetPasswordComponent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [txtPassword, setTxtPassword] = useState('');
  const [txtConfirmPassword, setTxtConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const token = String(searchParams.get('token') || '').trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    const password = txtPassword.trim();
    const confirmPassword = txtConfirmPassword.trim();

    if (!token) {
      setMessage('Link không hợp lệ');
      return;
    }

    if (!password || !confirmPassword) {
      setMessage('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (password.length < 6) {
      setMessage('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setLoading(true);

      const res = await API.post('/customer/reset-password', {
        token,
        password
      });

      if (res.data && res.data.success) {
        alert(res.data.message || 'Đặt lại mật khẩu thành công');
        navigate('/login');
      } else {
        setMessage(res.data?.message || 'Đặt lại mật khẩu thất bại');
      }
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.message || 'Không thể kết nối tới server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <MenuComponent />

      <div className="login-wrapper">
        <div className="login-box">
          <h1>Đặt lại mật khẩu</h1>

          <form className="login-form" onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="Nhập mật khẩu mới"
              value={txtPassword}
              onChange={(e) => setTxtPassword(e.target.value)}
            />

            <input
              type="password"
              placeholder="Nhập lại mật khẩu mới"
              value={txtConfirmPassword}
              onChange={(e) => setTxtConfirmPassword(e.target.value)}
            />

            {message && <p className="form-message">{message}</p>}

            <button type="submit" disabled={loading}>
              {loading ? 'ĐANG CẬP NHẬT...' : 'Đặt lại mật khẩu'}
            </button>
          </form>

          <div className="login-links">
            <Link to="/login">Quay lại đăng nhập</Link>
          </div>
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default ResetPasswordComponent;