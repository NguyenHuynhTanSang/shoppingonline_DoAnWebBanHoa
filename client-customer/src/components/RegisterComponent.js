import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function RegisterComponent() {
  const [txtName, setTxtName] = useState('');
  const [txtEmail, setTxtEmail] = useState('');
  const [txtUsername, setTxtUsername] = useState('');
  const [txtPassword, setTxtPassword] = useState('');
  const [txtConfirmPassword, setTxtConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');

    const name = txtName.trim();
    const email = txtEmail.trim().toLowerCase();
    const username = txtUsername.trim();
    const password = txtPassword.trim();
    const confirmPassword = txtConfirmPassword.trim();

    if (!name || !email || !username || !password || !confirmPassword) {
      setMessage('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setLoading(true);

      const res = await API.post('/customer/signup', {
        name,
        email,
        username,
        password
      });

      if (res.data.success === true) {
        alert(res.data.message || 'Đăng ký thành công');
        navigate('/login');
      } else {
        setMessage(res.data.message || 'Đăng ký thất bại');
      }
    } catch (error) {
      console.error('REGISTER ERROR:', error);

      if (error.response) {
        setMessage(error.response.data.message || 'Server error');
      } else {
        setMessage('Không thể kết nối tới server');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <MenuComponent />

      <div className="login-wrapper">
        <div className="login-box login-box-modern">
          <h1 className="login-title">Đăng ký</h1>

          <form className="login-form" onSubmit={handleRegister}>
            <div className="login-group">
              <label>Họ và tên <span>*</span></label>
              <input
                type="text"
                placeholder="Nhập họ và tên"
                value={txtName}
                onChange={(e) => setTxtName(e.target.value)}
              />
            </div>

            <div className="login-group">
              <label>Email <span>*</span></label>
              <input
                type="email"
                placeholder="Nhập email"
                value={txtEmail}
                onChange={(e) => setTxtEmail(e.target.value)}
              />
            </div>

            <div className="login-group">
              <label>Tên đăng nhập <span>*</span></label>
              <input
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={txtUsername}
                onChange={(e) => setTxtUsername(e.target.value)}
              />
            </div>

            <div className="login-group">
              <label>Mật khẩu <span>*</span></label>
              <input
                type="password"
                placeholder="Nhập mật khẩu"
                value={txtPassword}
                onChange={(e) => setTxtPassword(e.target.value)}
              />
            </div>

            <div className="login-group">
              <label>Xác nhận mật khẩu <span>*</span></label>
              <input
                type="password"
                placeholder="Nhập lại mật khẩu"
                value={txtConfirmPassword}
                onChange={(e) => setTxtConfirmPassword(e.target.value)}
              />
            </div>

            {message && <p className="form-message">{message}</p>}

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? 'ĐANG ĐĂNG KÝ...' : 'ĐĂNG KÝ'}
            </button>
          </form>

          <div className="register-line">
            <span>Đã có tài khoản?</span>
            <Link to="/login"> Đăng nhập ngay</Link>
          </div>
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default RegisterComponent;