import React from 'react';
import { Link } from 'react-router-dom';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

export default function NotFoundComponent() {
  return (
    <div>
      <MenuComponent />
      <main className="container product-detail-state">
        <h1>Không tìm thấy trang</h1>
        <p>Trang bạn đang tìm không tồn tại hoặc đã được thay đổi.</p>
        <Link to="/" className="product-detail-state-link">
          Về trang chủ
        </Link>
      </main>
      <InformComponent />
    </div>
  );
}
