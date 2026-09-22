import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

import API from '../services/api';

import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function RegisterComponent() {
  const [
    txtName,
    setTxtName
  ] = useState('');

  const [
    txtEmail,
    setTxtEmail
  ] = useState('');

  const [
    txtUsername,
    setTxtUsername
  ] = useState('');

  const [
    txtPassword,
    setTxtPassword
  ] = useState('');

  const [
    txtConfirmPassword,
    setTxtConfirmPassword
  ] = useState('');

  const [
    showPassword,
    setShowPassword
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword
  ] = useState(false);

  const [
    message,
    setMessage
  ] = useState('');

  const [
    loading,
    setLoading
  ] = useState(false);

  const navigate =
    useNavigate();

  const handleRegister =
    async event => {
      event.preventDefault();

      if (loading) {
        return;
      }

      setMessage('');

      const name =
        txtName.trim();

      const email =
        txtEmail
          .trim()
          .toLowerCase();

      const username =
        txtUsername.trim();

      const password =
        txtPassword.trim();

      const confirmPassword =
        txtConfirmPassword.trim();

      if (
        !name ||
        !email ||
        !username ||
        !password ||
        !confirmPassword
      ) {
        setMessage(
          'Vui lòng nhập đầy đủ thông tin.'
        );

        return;
      }

      if (password.length < 6 || new Blob([password]).size > 72) {
        setMessage('Mật khẩu phải có ít nhất 6 ký tự và không quá 72 byte UTF-8.');
        return;
      }

      if (
        password !==
        confirmPassword
      ) {
        setMessage(
          'Mật khẩu xác nhận không khớp.'
        );

        return;
      }

      try {
        setLoading(true);

        const res =
          await API.post(
            '/customer/signup',
            {
              name,
              email,
              username,
              password
            }
          );

        if (
          res.data.success ===
          true
        ) {
          alert(
            res.data.message ||
            'Đăng ký thành công'
          );

          navigate(
            '/login'
          );

          return;
        }

        setMessage(
          res.data.message ||
          'Đăng ký thất bại.'
        );
      } catch (error) {
        console.error(
          'REGISTER ERROR:',
          error
        );

        if (error.response) {
          setMessage(
            error.response.data
              ?.message ||
            'Máy chủ gặp lỗi, vui lòng thử lại.'
          );
        } else {
          setMessage(
            'Không thể kết nối tới máy chủ.'
          );
        }
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="wf-auth-page-shell">
      <MenuComponent />

      <main className="wf-auth-page">
        <section
          className="wf-auth-card"
          aria-labelledby="register-title"
        >
          <div className="wf-auth-heading">
            <span className="wf-auth-eyebrow">
              WIND FLOWER
            </span>

            <h1 id="register-title">
              Đăng ký
            </h1>

            <p>
              Tạo tài khoản để mua hoa,
              theo dõi đơn hàng và sử dụng
              các tiện ích dành cho khách hàng.
            </p>
          </div>

          <form
            className="wf-auth-form"
            onSubmit={
              handleRegister
            }
          >
            <div className="wf-auth-field">
              <label htmlFor="register-name">
                Họ và tên
                <span aria-hidden="true">
                  *
                </span>
              </label>

              <input
                id="register-name"
                name="name"
                type="text"
                placeholder="Nhập họ và tên"
                value={txtName}
                onChange={
                  event =>
                    setTxtName(
                      event.target.value
                    )
                }
                autoComplete="name"
                disabled={loading}
              />
            </div>

            <div className="wf-auth-field">
              <label htmlFor="register-email">
                Email
                <span aria-hidden="true">
                  *
                </span>
              </label>

              <input
                id="register-email"
                name="email"
                type="email"
                placeholder="Nhập email"
                value={txtEmail}
                onChange={
                  event =>
                    setTxtEmail(
                      event.target.value
                    )
                }
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="wf-auth-field">
              <label htmlFor="register-username">
                Tên đăng nhập
                <span aria-hidden="true">
                  *
                </span>
              </label>

              <input
                id="register-username"
                name="username"
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={txtUsername}
                onChange={
                  event =>
                    setTxtUsername(
                      event.target.value
                    )
                }
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="wf-auth-field">
              <label htmlFor="register-password">
                Mật khẩu
                <span aria-hidden="true">
                  *
                </span>
              </label>

              <div className="wf-auth-password">
                <input
                  id="register-password"
                  name="password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  placeholder="Nhập mật khẩu"
                  value={txtPassword}
                  onChange={
                    event =>
                      setTxtPassword(
                        event.target.value
                      )
                  }
                  autoComplete="new-password"
                  disabled={loading}
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
                      previous =>
                        !previous
                    )
                  }
                  disabled={loading}
                >
                  {showPassword
                    ? <FaEyeSlash />
                    : <FaEye />}
                </button>
              </div>
            </div>

            <div className="wf-auth-field">
              <label htmlFor="register-confirm-password">
                Xác nhận mật khẩu
                <span aria-hidden="true">
                  *
                </span>
              </label>

              <div className="wf-auth-password">
                <input
                  id="register-confirm-password"
                  name="confirmPassword"
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  placeholder="Nhập lại mật khẩu"
                  value={
                    txtConfirmPassword
                  }
                  onChange={
                    event =>
                      setTxtConfirmPassword(
                        event.target.value
                      )
                  }
                  autoComplete="new-password"
                  disabled={loading}
                />

                <button
                  type="button"
                  className="wf-auth-password-toggle"
                  aria-label={
                    showConfirmPassword
                      ? 'Ẩn mật khẩu xác nhận'
                      : 'Hiện mật khẩu xác nhận'
                  }
                  title={
                    showConfirmPassword
                      ? 'Ẩn mật khẩu'
                      : 'Hiện mật khẩu'
                  }
                  onClick={() =>
                    setShowConfirmPassword(
                      previous =>
                        !previous
                    )
                  }
                  disabled={loading}
                >
                  {showConfirmPassword
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
              disabled={loading}
            >
              {loading
                ? 'Đang đăng ký...'
                : 'Đăng ký'}
            </button>
          </form>

          <div className="wf-auth-divider">
            <span>
              Đã có tài khoản?
            </span>
          </div>

          <div className="wf-auth-register">
            <p>
              Nếu đã có tài khoản Wind Flower,
              bạn có thể đăng nhập để tiếp tục
              mua sắm.
            </p>

            <Link
              to="/login"
              className="wf-auth-secondary-button"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </section>
      </main>

      <InformComponent />
    </div>
  );
}

export default RegisterComponent;