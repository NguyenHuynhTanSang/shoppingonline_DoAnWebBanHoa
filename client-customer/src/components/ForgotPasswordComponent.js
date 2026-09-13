import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import API from '../services/api';

import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function ForgotPasswordComponent() {
  const [
    txtEmail,
    setTxtEmail
  ] = useState('');

  const [
    message,
    setMessage
  ] = useState('');

  const [
    messageType,
    setMessageType
  ] = useState('');

  const [
    loading,
    setLoading
  ] = useState(false);

  const handleSubmit =
    async event => {
      event.preventDefault();

      if (loading) {
        return;
      }

      setMessage('');
      setMessageType('');

      const email =
        txtEmail
          .trim()
          .toLowerCase();

      if (!email) {
        setMessage(
          'Vui lòng nhập email.'
        );

        setMessageType(
          'error'
        );

        return;
      }

      try {
        setLoading(true);

        const res =
          await API.post(
            '/customer/forgot-password',
            {
              email
            }
          );

        if (
          res.data &&
          res.data.success
        ) {
          setMessage(
            res.data.message ||
            'Đã gửi yêu cầu đặt lại mật khẩu.'
          );

          setMessageType(
            'success'
          );

          return;
        }

        setMessage(
          res.data?.message ||
          'Gửi yêu cầu thất bại.'
        );

        setMessageType(
          'error'
        );
      } catch (error) {
        const apiMessage =
          error.response
            ?.data?.message ||
          'Không thể kết nối tới máy chủ.';

        setMessage(
          apiMessage
        );

        setMessageType(
          'error'
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
          aria-labelledby="forgot-password-title"
        >
          <div className="wf-auth-heading">
            <span className="wf-auth-eyebrow">
              WIND FLOWER
            </span>

            <h1 id="forgot-password-title">
              Quên mật khẩu
            </h1>

            <p>
              Nhập email đã đăng ký tài khoản.
              Wind Flower sẽ tạo yêu cầu đặt lại
              mật khẩu cho bạn.
            </p>
          </div>

          <form
            className="wf-auth-form"
            onSubmit={
              handleSubmit
            }
          >
            <div className="wf-auth-field">
              <label htmlFor="forgot-password-email">
                Email
                <span aria-hidden="true">
                  *
                </span>
              </label>

              <input
                id="forgot-password-email"
                name="email"
                type="email"
                placeholder="Nhập email của bạn"
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

            {message && (
              <div
                className={
                  messageType ===
                  'success'
                    ? 'wf-auth-message wf-auth-message-success'
                    : 'wf-auth-message wf-auth-message-error'
                }
                role={
                  messageType ===
                  'error'
                    ? 'alert'
                    : 'status'
                }
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
                ? 'Đang gửi...'
                : 'Gửi yêu cầu'}
            </button>
          </form>

          <div className="wf-auth-divider">
            <span>
              Đã nhớ mật khẩu?
            </span>
          </div>

          <div className="wf-auth-register">
            <p>
              Quay lại trang đăng nhập để
              tiếp tục sử dụng tài khoản.
            </p>

            <Link
              to="/login"
              className="wf-auth-secondary-button"
            >
              Quay lại đăng nhập
            </Link>
          </div>
        </section>
      </main>

      <InformComponent />
    </div>
  );
}

export default ForgotPasswordComponent;