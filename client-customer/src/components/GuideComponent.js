import React from 'react';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function GuideComponent() {
  return (
    <div>
      <MenuComponent />

      <div className="container" style={{ padding: '40px 0' }}>
        <div className="info-page-box">
          <h1>Hướng dẫn mua hàng</h1>

          <p>
            Để đặt hoa tại Wind Flower, quý khách có thể thực hiện theo các bước sau:
          </p>

          <ol style={{ lineHeight: '2', marginTop: '20px' }}>
            <li>Truy cập website và chọn sản phẩm bạn muốn mua.</li>
            <li>Nhấn vào nút “Thêm vào giỏ hàng” hoặc “Mua ngay”.</li>
            <li>Kiểm tra giỏ hàng và cập nhật số lượng nếu cần.</li>
            <li>Nhấn “Mua hàng” để chuyển sang trang thanh toán.</li>
            <li>Điền đầy đủ thông tin người nhận, địa chỉ, số điện thoại.</li>
            <li>Chọn hình thức thanh toán phù hợp.</li>
            <li>Xác nhận đơn hàng và chờ nhân viên liên hệ nếu cần.</li>
          </ol>

          <h3>Lưu ý</h3>
          <ul style={{ lineHeight: '2' }}>
            <li>Vui lòng nhập chính xác thông tin người nhận để tránh giao nhầm.</li>
            <li>Một số mẫu hoa có thể thay đổi nhẹ theo mùa nhưng vẫn giữ tông và kiểu dáng chính.</li>
            <li>Trong trường hợp cần giao gấp, vui lòng liên hệ hotline để được hỗ trợ nhanh hơn.</li>
          </ul>
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default GuideComponent;