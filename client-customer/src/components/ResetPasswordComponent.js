import React, { useState } from 'react';
import {
  Link,
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import {
  FaEye,
  FaEyeSlash
} from 'react-icons/fa';

import API from '../services/api';

import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function ResetPasswordComponent() {
  const [searchParams] =
    useSearchParams();

  const navigate =
    useNavigate();

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

  const token =
    String(
      searchParams.get('token') ||
      ''
    ).trim();

  const hasToken =
    Boolean(token);

  const handleSubmit =
    async event => {
      event.preventDefault();

      if (loading) {
        return;
      }

      setMessage('');

      const password =
        txtPassword.trim();

      const confirmPassword =
        txtConfirmPassword.trim();

      if (!token) {
        setMessage(
          'Link đặt lại mật khẩu không hợp lệ.'
        );

        return;
      }

      if (
        !password ||
        !confirmPassword
      ) {
        setMessage(
          'Vui lòng nhập đầy đủ thông tin.'
        );

        return;
      }

      if (
        password.length < 6
      ) {
        setMessage(
          'Mật khẩu mới phải có ít nhất 6 ký tự.'
        );

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
            '/customer/reset-password',
            {
              token,
              password
            }
          );

        if (
          res.data &&
          res.data.success
        ) {
          alert(
            res.data.message ||
            'Đặt lại mật khẩu thành công.'
          );

          navigate('/login');

          return;
        }

        setMessage(
          res.data?.message ||
          'Đặt lại mật khẩu thất bại.'
        );
      } catch (error) {
        setMessage(
          error.response
            ?.data?.message ||
          'Không thể kết nối tới máy chủ.'
        );
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
          aria-labelledby="reset-password-title"
        >
          <div className="wf-auth-heading">
            <span className="wf-auth-eyebrow">
              WIND FLOWER
            </span>

            <h1 id="reset-password-title">
              Đặt lại mật khẩu
            </h1>

            <p>
              Tạo mật khẩu mới cho tài khoản
              Wind Flower của bạn.
            </p>
          </div>

          {!hasToken && (
            <div
              className="wf-auth-message wf-auth-message-error"
              role="alert"
            >
              Link đặt lại mật khẩu không hợp lệ
              hoặc thiếu token. Vui lòng tạo yêu cầu
              quên mật khẩu mới.
            </div>
          )}

          {hasToken && (
            <form
              className="wf-auth-form"
              onSubmit={
                handleSubmit
              }
            >
              <div className="wf-auth-field">
                <label htmlFor="reset-password">
                  Mật khẩu mới
                  <span aria-hidden="true">
                    *
                  </span>
                </label>

                <div className="wf-auth-password">
                  <input
                    id="reset-password"
                    name="password"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    placeholder="Nhập mật khẩu mới"
                    value={
                      txtPassword
                    }
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
                <label htmlFor="reset-confirm-password">
                  Xác nhận mật khẩu mới
                  <span aria-hidden="true">
                    *
                  </span>
                </label>

                <div className="wf-auth-password">
                  <input
                    id="reset-confirm-password"
                    name="confirmPassword"
                    type={
                      showConfirmPassword
                        ? 'text'
                        : 'password'
                    }
                    placeholder="Nhập lại mật khẩu mới"
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

              <p className="wf-auth-password-hint">
                Mật khẩu mới phải có ít nhất
                6 ký tự.
              </p>

              {message && (
                <div
                  className="wf-auth-message wf-auth-message-error"
                  role="alert"
                  aria-live="polite"
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
                  ? 'Đang cập nhật...'
                  : 'Đặt lại mật khẩu'}
              </button>
            </form>
          )}

          <div className="wf-auth-divider">
            <span>
              Tài khoản Wind Flower
            </span>
          </div>

          <div className="wf-auth-register">
            {hasToken ? (
              <p>
                Sau khi đặt lại mật khẩu thành công,
                bạn có thể đăng nhập bằng mật khẩu mới.
              </p>
            ) : (
              <p>
                Bạn có thể yêu cầu một link đặt lại
                mật khẩu mới.
              </p>
            )}

            {hasToken ? (
              <Link
                to="/login"
                className="wf-auth-secondary-button"
              >
                Quay lại đăng nhập
              </Link>
            ) : (
              <Link
                to="/forgot-password"
                className="wf-auth-secondary-button"
              >
                Yêu cầu link mới
              </Link>
            )}
          </div>
        </section>
      </main>

      <InformComponent />
    </div>
  );
}

export default ResetPasswordComponent;