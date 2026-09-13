import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function SidebarComponent({ pendingSupport }) {
  const location = useLocation();

  let user = null;

  try {
    user =
      JSON.parse(localStorage.getItem('adminUser') || 'null') ||
      JSON.parse(localStorage.getItem('admin') || 'null');
  } catch (error) {
    user = null;
  }

  const role = user?.role || localStorage.getItem('adminRole') || '';
  const canUseOperationalMenus = role === 'admin' || role === 'staff';
  const isAdmin = role === 'admin';

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <div className="admin-sidebar">
      <h3>Quản trị</h3>

      {canUseOperationalMenus && (
        <>
          <Link to="/support-requests" className={isActive('/support-requests')}>AI &amp; Hỗ trợ
            {pendingSupport > 0 && <span aria-label={`${pendingSupport} yêu cầu đang chờ`} style={{ marginLeft: 8, padding: '2px 7px', borderRadius: 12, background: '#b42318', color: '#fff', fontSize: 12 }}>{pendingSupport}</span>}
          </Link>
          <Link to="/dashboard" className={isActive('/dashboard')}>
            Dashboard
          </Link>

          <Link to="/products" className={isActive('/products')}>
            Sản phẩm
          </Link>

          <Link to="/categories" className={isActive('/categories')}>
            Danh mục
          </Link>

          <Link to="/vouchers" className={isActive('/vouchers')}>
            Voucher
          </Link>

          <Link to="/customers" className={isActive('/customers')}>
            Khách hàng
          </Link>

          <Link to="/orders" className={isActive('/orders')}>
            Đơn hàng
          </Link>
        </>
      )}

      {isAdmin && (
        <Link to="/staffs" className={isActive('/staffs')}>
          Nhân viên
        </Link>
      )}
    </div>
  );
}

export default SidebarComponent;
