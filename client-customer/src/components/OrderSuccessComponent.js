import React from 'react';
import { Link } from 'react-router-dom';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function OrderSuccessComponent() {
  const order = JSON.parse(localStorage.getItem('latestOrder'));

  return (
    <div>
      <MenuComponent />

      <div className="container order-success-page">
        <div className="order-success-box">
          <h1>Đặt hàng thành công</h1>
          <p>Cảm ơn bạn đã mua hàng tại Wind Flower.</p>

          {order ? (
            <div className="order-success-info">
              <p><strong>Mã đơn hàng:</strong> {order.orderId}</p>
              <p><strong>Khách hàng:</strong> {order.customerInfo.fullName}</p>
              <p><strong>Số điện thoại:</strong> {order.customerInfo.phone}</p>
              <p><strong>Địa chỉ:</strong> {order.customerInfo.address}</p>
              <p><strong>Thời gian đặt:</strong> {order.createdAt}</p>
              <p><strong>Tổng thanh toán:</strong> {order.total.toLocaleString('vi-VN')} đ</p>
            </div>
          ) : (
            <p>Không tìm thấy thông tin đơn hàng gần nhất.</p>
          )}

          <div className="order-success-actions">
            <Link to="/" className="success-btn">
              Về trang chủ
            </Link>
            <Link to="/category/bo-hoa-8-3" className="success-btn outline">
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default OrderSuccessComponent;