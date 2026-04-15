import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LayoutComponent from '../components/LayoutComponent';
import API from '../services/api';

function DashboardComponent() {
  const [stats, setStats] = useState({
    productCount: 0,
    categoryCount: 0,
    customerCount: 0,
    orderCount: 0,
    revenue: 0,
    totalStock: 0,
    totalSold: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/statistics');

      if (res.data && res.data.success) {
        setStats(res.data.statistics || {});
        setMessage('');
      } else {
        setMessage(res.data?.message || 'Không thể tải dữ liệu dashboard');
      }
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.message || 'Lỗi tải dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (value) => {
    return Number(value || 0).toLocaleString('vi-VN') + ' đ';
  };

  return (
    <LayoutComponent>
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <p>Tổng quan nhanh toàn bộ hệ thống bán hoa.</p>
      </div>

      {message && <p className="error-text">{message}</p>}

      {loading ? (
        <div className="admin-empty-box">
          <p>Đang tải dữ liệu dashboard...</p>
        </div>
      ) : (
        <div className="dashboard-clean">
          <div className="dashboard-top-grid">
            <div className="dashboard-stat-card primary">
              <p>Sản phẩm</p>
              <h3>{stats.productCount}</h3>
              <Link to="/admin/products">Đi đến quản lý sản phẩm</Link>
            </div>

            <div className="dashboard-stat-card primary">
              <p>Khách hàng</p>
              <h3>{stats.customerCount}</h3>
              <Link to="/admin/customers">Đi đến quản lý khách hàng</Link>
            </div>

            <div className="dashboard-stat-card primary">
              <p>Đơn hàng</p>
              <h3>{stats.orderCount}</h3>
              <Link to="/admin/orders">Đi đến quản lý đơn hàng</Link>
            </div>

            <div className="dashboard-stat-card revenue">
              <p>Doanh thu</p>
              <h3>{formatMoney(stats.revenue)}</h3>
              <span>Tổng giá trị đơn hàng hiện tại</span>
            </div>
          </div>

          <div className="dashboard-mid-grid">
            <div className="dashboard-stat-card small">
              <p>Danh mục</p>
              <h4>{stats.categoryCount}</h4>
            </div>

            <div className="dashboard-stat-card small">
              <p>Tổng tồn kho</p>
              <h4>{stats.totalStock}</h4>
            </div>

            <div className="dashboard-stat-card small warning">
              <p>Sắp hết hàng</p>
              <h4>{stats.lowStockCount}</h4>
            </div>

            <div className="dashboard-stat-card small danger">
              <p>Hết hàng</p>
              <h4>{stats.outOfStockCount}</h4>
            </div>
          </div>

          <div className="dashboard-bottom-grid">
            <div className="dashboard-panel">
              <h4>Truy cập nhanh</h4>
              <div className="dashboard-quick-links">
                <Link to="/admin/products">Quản lý sản phẩm</Link>
                <Link to="/admin/categories">Quản lý danh mục</Link>
                <Link to="/admin/customers">Quản lý khách hàng</Link>
                <Link to="/admin/orders">Quản lý đơn hàng</Link>
              </div>
            </div>

            <div className="dashboard-panel">
              <h4>Gợi ý vận hành</h4>
              <ul className="dashboard-note-list">
                <li>
                  {Number(stats.outOfStockCount || 0) > 0
                    ? `Hiện có ${stats.outOfStockCount} sản phẩm đã hết hàng.`
                    : 'Hiện chưa có sản phẩm nào hết hàng.'}
                </li>
                <li>
                  {Number(stats.lowStockCount || 0) > 0
                    ? `Có ${stats.lowStockCount} sản phẩm sắp hết hàng.`
                    : 'Hiện chưa có sản phẩm nào ở mức sắp hết hàng.'}
                </li>
                <li>Tổng số lượng sản phẩm đã bán: {stats.totalSold}</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </LayoutComponent>
  );
}

export default DashboardComponent;