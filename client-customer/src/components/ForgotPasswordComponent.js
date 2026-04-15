import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function ForgotPasswordComponent() {
  const [txtEmail, setTxtEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCopyLink = async () => {
    try {
      if (!resetLink) return;
      await navigator.clipboard.writeText(resetLink);
      alert('Đã copy link đặt lại mật khẩu');
    } catch (error) {
      console.error(error);
      alert('Không thể copy link');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setResetLink('');

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

        if (res.data.resetLink) {
          setResetLink(res.data.resetLink);
        }
      } else {
        setMessage(res.data?.message || 'Gửi yêu cầu thất bại');
      }
    } catch (error) {
      console.error(error);

      const apiMessage =
        error.response?.data?.message || 'Không thể kết nối tới server';
      const apiResetLink = error.response?.data?.resetLink || '';

      setMessage(apiMessage);
      setResetLink(apiResetLink);
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

            {resetLink && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#fff4f8',
                  border: '1px solid #f8bbd0',
                  textAlign: 'left'
                }}
              >
                <p
                  style={{
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#c2185b'
                  }}
                >
                  Link đặt lại mật khẩu tạm thời:
                </p>

                <a
                  href={resetLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'block',
                    wordBreak: 'break-all',
                    color: '#ad1457',
                    marginBottom: '10px'
                  }}
                >
                  {resetLink}
                </a>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <a
                    href={resetLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#e91e63',
                      color: '#fff',
                      textDecoration: 'none',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontWeight: 'bold'
                    }}
                  >
                    Mở link đặt lại mật khẩu
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    style={{
                      background: '#6b7280',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Copy link
                  </button>
                </div>
              </div>
            )}

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