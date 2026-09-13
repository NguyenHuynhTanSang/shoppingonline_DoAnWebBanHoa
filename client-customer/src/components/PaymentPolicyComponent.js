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

          <h3 style={{ marginTop: '24px' }}>3. Chuyển khoản ngân hàng và MoMo (demo)</h3>
          <p>
            Chuyển khoản ngân hàng và MoMo tại checkout hiện chỉ là demo,
            chưa phải luồng thanh toán hoặc hoàn tiền trực tuyến thực tế.
          </p>

          <p style={{ marginTop: '18px' }}>
            Nếu có vấn đề về thanh toán, vui lòng liên hệ Wind Flower để nhân viên kiểm tra.
          </p>
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default PaymentPolicyComponent;
