import React from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAdminSession } from '../services/adminSession';

function HeaderComponent() {
  const navigate = useNavigate();
  let admin = {};
  try {
    admin = JSON.parse(localStorage.getItem('admin')) || {};
  } catch (error) {
    admin = {};
  }

  const handleLogout = () => {
    clearAdminSession();

    navigate('/login', { replace: true });
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