import React from 'react';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function ContactComponent() {
  const address = '123 Nguyễn Văn A, Quận 1, TP.HCM';
  const mapLink =
    'https://www.google.com/maps/search/?api=1&query=123+Nguyen+Van+A,+Quan+1,+TP.HCM';

  return (
    <div>
      <MenuComponent />

      <div className="container" style={{ padding: '40px 0' }}>
        <div className="info-page-box">
          <h1>Liên hệ</h1>

          <p><strong>Cửa hàng:</strong> Wind Flower</p>
          <p><strong>Địa chỉ:</strong> {address}</p>
          <p><strong>Hotline:</strong> 093.130.3836</p>
          <p><strong>Email:</strong> flowershop@gmail.com</p>
          <p><strong>Thời gian làm việc:</strong> 8h30 - 21h00 mỗi ngày</p>

          <div style={{ marginTop: '24px' }}>
            <iframe
              title="Google Map Contact"
              src="https://www.google.com/maps?q=123+Nguyen+Van+A,+Quan+1,+TP.HCM&output=embed"
              width="100%"
              height="320"
              style={{ border: 0, borderRadius: '12px' }}
              loading="lazy"
              allowFullScreen
            ></iframe>
          </div>

          <div style={{ marginTop: '14px' }}>
            <a
              href={mapLink}
              target="_blank"
              rel="noreferrer"
              className="map-link-btn"
            >
              Xem địa chỉ trên Google Maps
            </a>
          </div>
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default ContactComponent;