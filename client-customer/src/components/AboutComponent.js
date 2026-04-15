import React from 'react';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function AboutComponent() {
  return (
    <div>
      <MenuComponent />

      <div className="container" style={{ padding: '40px 0' }}>
        <div className="info-page-box">
          <h1>Giới thiệu</h1>
          <p>
            Wind Flower là cửa hàng hoa tươi chuyên cung cấp các mẫu bó hoa, giỏ hoa,
            bình hoa và hoa theo từng dịp đặc biệt như sinh nhật, khai trương, 8-3,
            ngày kỷ niệm và các sự kiện quan trọng.
          </p>

          <p>
            Chúng tôi mong muốn mang đến những sản phẩm hoa tươi đẹp, sang trọng và
            phù hợp với từng nhu cầu của khách hàng. Mỗi sản phẩm đều được chọn lựa
            kỹ càng, cắm và đóng gói cẩn thận trước khi giao đến tay người nhận.
          </p>

          <p>
            Với phương châm đặt chất lượng và trải nghiệm khách hàng lên hàng đầu,
            Wind Flower luôn cố gắng cải thiện dịch vụ, đảm bảo giao đúng mẫu, đúng
            thời gian và hỗ trợ khách hàng nhanh chóng trong suốt quá trình mua hàng.
          </p>

          <h3>Tầm nhìn</h3>
          <p>
            Trở thành một trong những cửa hàng hoa trực tuyến được khách hàng tin tưởng
            và lựa chọn nhiều nhất tại TP.HCM.
          </p>

          <h3>Sứ mệnh</h3>
          <p>
            Mang những bó hoa đẹp và ý nghĩa đến gần hơn với mọi người, giúp khách hàng
            dễ dàng gửi gắm tình cảm qua từng món quà.
          </p>
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default AboutComponent;