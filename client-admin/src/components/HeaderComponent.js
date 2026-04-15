import React from 'react';
import { useNavigate } from 'react-router-dom';

function HeaderComponent() {
  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem('admin')) || {};

  const handleLogout = () => {
    localStorage.removeItem('admin');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('token');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminRole');

    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="admin-header">
      <h2>ADMIN PANEL</h2>
      <div className="admin-header-right">
        <span>Xin chào, {admin.username || 'Admin'}</span>
        <button onClick={handleLogout}>Đăng xuất</button>
      </div>
    </div>
  );
}

export default HeaderComponent;