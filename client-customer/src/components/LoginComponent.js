import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import API from '../services/api';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function LoginComponent() {
  const [showPassword, setShowPassword] = useState(false);
  const [txtUsername, setTxtUsername] = useState('');
  const [txtPassword, setTxtPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!txtUsername || !txtPassword) {
      setMessage('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    try {
      const res = await API.post('/customer/login', {
        username: txtUsername,
        password: txtPassword
      });

      if (res.data.success === true) {
        localStorage.setItem('customerToken', res.data.token);
        localStorage.setItem('customer', JSON.stringify(res.data.customer || {}));
        alert('Đăng nhập thành công');
        navigate('/');
        window.location.reload();
      } else {
        setMessage(res.data.message || 'Đăng nhập thất bại');
      }
    } catch (error) {
      console.error(error);
      if (error.response) {
        setMessage(error.response.data.message || 'Server error');
      } else {
        setMessage('Không thể kết nối tới server');
      }
    }
  };

  return (
    <div>
      <MenuComponent />

      <div className="login-wrapper">
        <div className="login-box login-box-modern">
          <h1 className="login-title">LOGIN</h1>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="login-group">
              <label>Username or email address <span>*</span></label>
              <input
                type="text"
                placeholder="Nhập tên đăng nhập hoặc email"
                value={txtUsername}
                onChange={(e) => setTxtUsername(e.target.value)}
              />
            </div>

            <div className="login-group">
              <label>Mật khẩu <span>*</span></label>

              <div className="password-box">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  value={txtPassword}
                  onChange={(e) => setTxtPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {message && <p className="form-message">{message}</p>}

            <button type="submit" className="login-submit-btn">
              ĐĂNG NHẬP
            </button>
          </form>

          <div className="login-extra-row">
            <label className="remember-me">
              <input type="checkbox" />
              <span>Nhớ tôi</span>
            </label>

            <Link to="/forgot-password" className="forgot-link">
              Quên mật khẩu?
            </Link>
          </div>

          <div className="register-line">
            <span>Bạn chưa có tài khoản?</span>
            <Link to="/register"> Đăng ký ngay</Link>
          </div>
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default LoginComponent;