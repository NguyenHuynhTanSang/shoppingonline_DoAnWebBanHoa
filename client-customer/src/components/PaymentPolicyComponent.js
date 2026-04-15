import React from 'react';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function PaymentPolicyComponent() {
  return (
    <div>
      <MenuComponent />

      <div className="container" style={{ padding: '40px 0' }}>
        <div className="info-page-box">
          <h1>Hình thức thanh toán</h1>

          <p>Quý khách có thể lựa chọn một trong các hình thức thanh toán sau:</p>

          <h3 style={{ marginTop: '24px' }}>1. Thanh toán tiền mặt</h3>
          <p>
            Quý khách có thể thanh toán trực tiếp tại cửa hàng hoặc thanh toán khi nhận
            hàng đối với các đơn đủ điều kiện áp dụng.
          </p>

          <h3 style={{ marginTop: '24px' }}>2. Thanh toán khi nhận hoa</h3>
          <p>
            Nhân viên giao hàng sẽ thu tiền trực tiếp khi giao hàng cho người nhận hoặc
            người đặt, tùy theo thông tin đơn hàng đã xác nhận.
          </p>

          <h3 style={{ marginTop: '24px' }}>3. Thanh toán chuyển khoản</h3>
          <p>
            Quý khách có thể chuyển khoản trước theo thông tin tài khoản mà cửa hàng cung cấp.
          </p>

          <ul style={{ lineHeight: '2', marginTop: '10px' }}>
            <li>Ngân hàng: Vietcombank</li>
            <li>Chủ tài khoản: WIND FLOWER SHOP</li>
            <li>Số tài khoản: 0123456789</li>
            <li>Nội dung chuyển khoản: Tên hoặc số điện thoại người đặt</li>
          </ul>

          <p style={{ marginTop: '18px' }}>
            Sau khi chuyển khoản, vui lòng liên hệ hotline để cửa hàng xác nhận nhanh hơn.
          </p>
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default PaymentPolicyComponent;