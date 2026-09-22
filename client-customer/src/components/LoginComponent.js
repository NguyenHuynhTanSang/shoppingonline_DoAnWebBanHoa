import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

import API from '../services/api';

import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function LoginComponent() {
  const [showPassword, setShowPassword] = useState(false);

  const [txtUsername, setTxtUsername] = useState('');
  const [txtPassword, setTxtPassword] = useState('');

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from === '/checkout' ? '/checkout' : '/';

  const handleLogin = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setMessage('');

    const username = txtUsername.trim();

    if (!username || !txtPassword) {
      setMessage('Vui lòng nhập đầy đủ thông tin.');
      return;
    }

    try {
      setSubmitting(true);

      const res = await API.post(
        '/customer/login',
        {
          username,
          password: txtPassword
        }
      );

      if (res.data.success === true) {
        localStorage.setItem(
          'customerToken',
          res.data.token
        );

        localStorage.setItem(
          'customer',
          JSON.stringify(
            res.data.customer || {}
          )
        );

        navigate(destination);

        return;
      }

      setMessage(
        res.data.message ||
        'Đăng nhập thất bại.'
      );
    } catch (error) {
      console.error(
        'LOGIN ERROR:',
        error
      );

      if (error.response) {
        setMessage(
          error.response.data?.message ||
          'Máy chủ gặp lỗi, vui lòng thử lại.'
        );
      } else {
        setMessage(
          'Không thể kết nối tới máy chủ.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wf-auth-page-shell">
      <MenuComponent />

      <main className="wf-auth-page">
        <section
          className="wf-auth-card"
          aria-labelledby="login-title"
        >
          <div className="wf-auth-heading">
            <span className="wf-auth-eyebrow">
              WIND FLOWER
            </span>

            <h1 id="login-title">
              Đăng nhập
            </h1>

            <p>
              Đăng nhập để mua hoa,
              theo dõi đơn hàng và sử dụng
              các tiện ích dành cho khách hàng.
            </p>
          </div>

          <form
            className="wf-auth-form"
            onSubmit={handleLogin}
          >
            <div className="wf-auth-field">
              <label htmlFor="login-username">
                Tên đăng nhập hoặc email
                <span aria-hidden="true">
                  *
                </span>
              </label>

              <input
                id="login-username"
                name="username"
                type="text"
                placeholder="Nhập tên đăng nhập hoặc email"
                value={txtUsername}
                onChange={(event) =>
                  setTxtUsername(
                    event.target.value
                  )
                }
                autoComplete="username"
                disabled={submitting}
              />
            </div>

            <div className="wf-auth-field">
              <label htmlFor="login-password">
                Mật khẩu
                <span aria-hidden="true">
                  *
                </span>
              </label>

              <div className="wf-auth-password">
                <input
                  id="login-password"
                  name="password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  placeholder="Nhập mật khẩu"
                  value={txtPassword}
                  onChange={(event) =>
                    setTxtPassword(
                      event.target.value
                    )
                  }
                  autoComplete="current-password"
                  disabled={submitting}
                />

                <button
                  type="button"
                  className="wf-auth-password-toggle"
                  aria-label={
                    showPassword
                      ? 'Ẩn mật khẩu'
                      : 'Hiện mật khẩu'
                  }
                  title={
                    showPassword
                      ? 'Ẩn mật khẩu'
                      : 'Hiện mật khẩu'
                  }
                  onClick={() =>
                    setShowPassword(
                      (previous) =>
                        !previous
                    )
                  }
                  disabled={submitting}
                >
                  {showPassword
                    ? <FaEyeSlash />
                    : <FaEye />}
                </button>
              </div>
            </div>

            {message && (
              <div
                className="wf-auth-message wf-auth-message-error"
                role="alert"
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              className="wf-auth-submit"
              disabled={submitting}
            >
              {submitting
                ? 'Đang đăng nhập...'
                : 'Đăng nhập'}
            </button>
          </form>

          <div className="wf-auth-options">
            <Link
              to="/forgot-password"
              className="wf-auth-link"
            >
              Quên mật khẩu?
            </Link>
          </div>

          <div className="wf-auth-divider">
            <span>
              Chưa có tài khoản?
            </span>
          </div>

          <div className="wf-auth-register">
            <p>
              Tạo tài khoản để lưu thông tin
              mua hàng và theo dõi đơn dễ dàng hơn.
            </p>

            <Link
              to="/register"
              className="wf-auth-secondary-button"
            >
              Đăng ký tài khoản
            </Link>
          </div>
        </section>
      </main>

      <InformComponent />
    </div>
  );
}

export default LoginComponent;