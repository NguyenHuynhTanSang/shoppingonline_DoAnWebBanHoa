import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function formatMoney(value) {
  return Number(
    value || 0
  ).toLocaleString('vi-VN');
}

function getLatestOrder() {
  try {
    const rawOrder =
      localStorage.getItem(
        'latestOrder'
      );

    if (!rawOrder) {
      return null;
    }

    const parsedOrder =
      JSON.parse(
        rawOrder
      );

    if (
      !parsedOrder ||
      typeof parsedOrder !==
        'object'
    ) {
      return null;
    }

    return parsedOrder;
  } catch (error) {
    console.error(
      'READ LATEST ORDER ERROR:',
      error
    );

    return null;
  }
}

function OrderSuccessComponent() {
  const order =
    useMemo(
      () =>
        getLatestOrder(),
      []
    );

  const customerInfo =
    order?.customerInfo ||
    {};

  return (
    <div className="wf-order-success-page-shell">
      <MenuComponent />

      <main className="container wf-order-success-page">
        <section className="wf-order-success-card">
          <div
            className="wf-order-success-icon"
            aria-hidden="true"
          >
            ✓
          </div>

          <div className="wf-order-success-heading">
            <span className="wf-order-success-eyebrow">
              WIND FLOWER
            </span>

            <h1>
              Đặt hàng thành công
            </h1>

            <p>
              Cảm ơn bạn đã mua hàng
              tại Wind Flower.
              Thông tin đơn hàng của
              bạn đã được ghi nhận.
            </p>
          </div>

          {order ? (
            <>
              <div className="wf-order-success-order-code">
                <span>
                  MÃ ĐƠN HÀNG
                </span>

                <strong>
                  {order.orderId ||
                    'Chưa có'}
                </strong>
              </div>

              <section className="wf-order-success-section">
                <div className="wf-order-success-section-heading">
                  <span>
                    GIAO HÀNG
                  </span>

                  <h2>
                    Thông tin giao hoa
                  </h2>
                </div>

                <div className="wf-order-success-grid">
                  <div className="wf-order-success-info-item">
                    <span>
                      Ngày giao hoa
                    </span>

                    <strong>
                      {order.deliveryDate ||
                        '—'}
                    </strong>
                  </div>

                  <div className="wf-order-success-info-item">
                    <span>
                      Khung giờ giao mong muốn
                    </span>

                    <strong>
                      {order.deliveryTimeSlot ||
                        '—'}
                    </strong>
                  </div>

                  <div className="wf-order-success-info-item">
                    <span>
                      Khách hàng
                    </span>

                    <strong>
                      {customerInfo.fullName ||
                        'Chưa có'}
                    </strong>
                  </div>

                  <div className="wf-order-success-info-item">
                    <span>
                      Số điện thoại
                    </span>

                    <strong>
                      {customerInfo.phone ||
                        'Chưa có'}
                    </strong>
                  </div>

                  <div className="wf-order-success-info-item wf-order-success-info-item-wide">
                    <span>
                      Địa chỉ giao hàng
                    </span>

                    <strong>
                      {customerInfo.address ||
                        'Chưa có'}
                    </strong>
                  </div>

                  <div className="wf-order-success-info-item wf-order-success-info-item-wide">
                    <span>
                      Lời nhắn thiệp
                    </span>

                    <strong className="wf-order-success-preserve-text">
                      {order.cardMessage ||
                        '—'}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="wf-order-success-section">
                <div className="wf-order-success-section-heading">
                  <span>
                    ĐƠN HÀNG
                  </span>

                  <h2>
                    Tóm tắt thanh toán
                  </h2>
                </div>

                <div className="wf-order-success-summary">
                  <div className="wf-order-success-summary-row">
                    <span>
                      Thời gian đặt
                    </span>

                    <strong>
                      {order.createdAt ||
                        'Chưa có'}
                    </strong>
                  </div>

                  <div className="wf-order-success-total">
                    <span>
                      Tổng thanh toán
                    </span>

                    <strong>
                      {formatMoney(
                        order.total
                      )}{' '}
                      đ
                    </strong>
                  </div>
                </div>
              </section>

              <div className="wf-order-success-note">
                <strong>
                  Đơn hàng tiếp theo sẽ thế nào?
                </strong>

                <p>
                  Bạn có thể vào mục
                  Đơn hàng của tôi để
                  theo dõi trạng thái và
                  xem lại thông tin đơn hàng.
                </p>
              </div>
            </>
          ) : (
            <div className="wf-order-success-empty">
              <strong>
                Không tìm thấy thông tin
                đơn hàng gần nhất.
              </strong>

              <p>
                Bạn vẫn có thể vào mục
                Đơn hàng của tôi để kiểm tra
                lịch sử mua hàng.
              </p>
            </div>
          )}

          <div className="wf-order-success-actions">
            <Link
              to="/my-orders"
              className="wf-order-success-primary-button"
            >
              Xem đơn hàng của tôi
            </Link>

            <Link
              to="/"
              className="wf-order-success-secondary-button"
            >
              Về trang chủ
            </Link>

            <Link
              to="/category/bo-hoa-8-3"
              className="wf-order-success-text-button"
            >
              Tiếp tục mua sắm →
            </Link>
          </div>
        </section>
      </main>

      <InformComponent />
    </div>
  );
}

export default OrderSuccessComponent;