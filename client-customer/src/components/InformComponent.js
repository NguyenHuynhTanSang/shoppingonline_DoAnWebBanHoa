import React from 'react';
import { Link } from 'react-router-dom';

function InformComponent() {
  const address = '123 Nguyễn Văn A, Quận 1, TP.HCM';
  const mapLink =
    'https://www.google.com/maps/search/?api=1&query=123+Nguyen+Van+A,+Quan+1,+TP.HCM';

  return (
    <footer className="footer-section">
      <div className="container footer-grid">
        <div className="footer-box">
          <h3>Thông Tin Liên Hệ</h3>
          <ul>
            <li>Shop hoa tươi Wind Flower</li>
            <li>Web: flower-shop.vn</li>
            <li>Địa chỉ: {address}</li>
            <li>Hotline: 093.130.3836</li>
            <li>Email: flowershop@gmail.com</li>
            <li>Thời gian làm việc: 8h30 - 21h00</li>
          </ul>
        </div>

        <div className="footer-box">
          <h3>Chính Sách</h3>
          <ul className="footer-link-list">
            <li>
              <Link to="/gioi-thieu">Giới thiệu</Link>
            </li>
            <li>
              <Link to="/tin-tuc">Tin tức</Link>
            </li>
            <li>
              <Link to="/huong-dan-mua-hang">Hướng dẫn mua hàng</Link>
            </li>
            <li>
              <Link to="/hinh-thuc-thanh-toan">Hình thức thanh toán</Link>
            </li>
            <li>
              <Link to="/lien-he">Liên hệ</Link>
            </li>
          </ul>
        </div>

        <div className="footer-box">
          <h3>Tiện Ích</h3>

          <div className="map-box">
            <iframe
              title="Google Map"
              src="https://www.google.com/maps?q=123+Nguyen+Van+A,+Quan+1,+TP.HCM&output=embed"
              width="100%"
              height="220"
              style={{ border: 0, borderRadius: '10px' }}
              loading="lazy"
              allowFullScreen
            ></iframe>
          </div>

          <div style={{ marginTop: '12px' }}>
            <a
              href={mapLink}
              target="_blank"
              rel="noreferrer"
              className="map-link-btn"
            >
              Mở Google Maps
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default InformComponent;