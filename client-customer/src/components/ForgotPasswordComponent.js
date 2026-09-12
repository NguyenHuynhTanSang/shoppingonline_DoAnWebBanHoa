import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function ForgotPasswordComponent() {
  const [txtEmail, setTxtEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    const email = txtEmail.trim().toLowerCase();

    if (!email) {
      setMessage('Vui lòng nhập email');
      return;
    }

    try {
      setLoading(true);

      const res = await API.post('/customer/forgot-password', {
        email: email
      });

      if (res.data && res.data.success) {
        setMessage(res.data.message || 'Đã gửi yêu cầu đặt lại mật khẩu');

      } else {
        setMessage(res.data?.message || 'Gửi yêu cầu thất bại');
      }
    } catch (error) {

      const apiMessage =
        error.response?.data?.message || 'Không thể kết nối tới server';

      setMessage(apiMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <MenuComponent />

      <div className="login-wrapper">
        <div className="login-box">
          <h1>Quên mật khẩu</h1>

          <form className="login-form" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Nhập email của bạn"
              value={txtEmail}
              onChange={(e) => setTxtEmail(e.target.value)}
            />

            {message && <p className="form-message">{message}</p>}

            <button type="submit" disabled={loading}>
              {loading ? 'ĐANG GỬI...' : 'Gửi yêu cầu'}
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

export default ForgotPasswordComponent;