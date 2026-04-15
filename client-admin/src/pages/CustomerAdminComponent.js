import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutComponent from '../components/LayoutComponent';
import API from '../services/api';

function CustomerAdminComponent() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [openCustomerId, setOpenCustomerId] = useState(null);
  const [updatingId, setUpdatingId] = useState('');

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  let user = null;
  try {
    user =
      JSON.parse(localStorage.getItem('adminUser') || 'null') ||
      JSON.parse(localStorage.getItem('admin') || 'null');
  } catch (error) {
    user = null;
  }

  const role = user?.role || localStorage.getItem('adminRole') || '';
  const isAdmin = role === 'admin';
  const canUpdateCustomerStatus = isAdmin;

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/customers');

      if (res.data && res.data.success) {
        const data = res.data.customers || [];
        setCustomers(data);
        setMessage('');
      } else {
        setCustomers([]);
        setMessage(res.data?.message || 'Không thể tải danh sách khách hàng');
      }
    } catch (error) {
      console.error(error);
      setCustomers([]);
      setMessage(error.response?.data?.message || 'Lỗi tải danh sách khách hàng');
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchText('');
    setStatusFilter('all');
    setSortBy('newest');
  };

  const toggleDetail = (customerId) => {
    setOpenCustomerId((prev) => (prev === customerId ? null : customerId));
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      alert(`Đã copy ${label}`);
    } catch (error) {
      console.error(error);
      alert(`Không thể copy ${label}`);
    }
  };

  const formatDate = (value) => {
    if (!value) return 'Chưa có';
    try {
      return new Date(Number(value)).toLocaleString('vi-VN');
    } catch {
      return 'Chưa có';
    }
  };

  const getStatusText = (active) => {
    const val = Number(active);
    if (val === 1) return 'Đang hoạt động';
    if (val === -1) return 'Đã khóa';
    return 'Chưa kích hoạt';
  };

  const getStatusClass = (active) => {
    const val = Number(active);
    if (val === 1) return 'admin-customer-status active';
    if (val === -1) return 'admin-customer-status locked';
    return 'admin-customer-status inactive';
  };

  const handleUpdateStatus = async (customerId, newStatus) => {
    if (!canUpdateCustomerStatus) {
      alert('Chỉ admin mới có quyền cập nhật trạng thái khách hàng.');
      return;
    }

    try {
      let confirmText = 'Bạn có chắc muốn cập nhật trạng thái tài khoản này không?';

      if (Number(newStatus) === -1) {
        confirmText = 'Bạn có chắc muốn KHÓA tài khoản khách hàng này không?';
      } else if (Number(newStatus) === 1) {
        confirmText = 'Bạn có chắc muốn MỞ / KÍCH HOẠT tài khoản khách hàng này không?';
      }

      const ok = window.confirm(confirmText);
      if (!ok) return;

      setUpdatingId(customerId);

      const res = await API.put(`/admin/customers/${customerId}/status`, {
        active: Number(newStatus)
      });

      if (res.data && res.data.success) {
        alert('Cập nhật trạng thái khách hàng thành công');
        fetchCustomers();
      } else {
        alert(res.data?.message || 'Không thể cập nhật trạng thái khách hàng');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi cập nhật trạng thái khách hàng');
    } finally {
      setUpdatingId('');
    }
  };

  const goToCustomerOrders = (customer) => {
    const keyword =
      customer.phone || customer.name || customer.username || customer.email || '';
    localStorage.setItem('adminOrderCustomerKeyword', keyword);
    navigate('/orders');
  };

  const filteredCustomers = useMemo(() => {
    let result = [...customers];
    const keyword = searchText.trim().toLowerCase();

    if (keyword) {
      result = result.filter((item) => {
        const username = String(item.username || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        const phone = String(item.phone || '').toLowerCase();
        const email = String(item.email || '').toLowerCase();

        return (
          username.includes(keyword) ||
          name.includes(keyword) ||
          phone.includes(keyword) ||
          email.includes(keyword)
        );
      });
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        result = result.filter((item) => Number(item.active) === 1);
      } else if (statusFilter === 'inactive') {
        result = result.filter((item) => Number(item.active) === 0);
      } else if (statusFilter === 'locked') {
        result = result.filter((item) => Number(item.active) === -1);
      }
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'nameAsc':
          return String(a.name || '').localeCompare(String(b.name || ''));
        case 'nameDesc':
          return String(b.name || '').localeCompare(String(a.name || ''));
        case 'usernameAsc':
          return String(a.username || '').localeCompare(String(b.username || ''));
        case 'usernameDesc':
          return String(b.username || '').localeCompare(String(a.username || ''));
        case 'newest':
        default:
          return String(b._id || '').localeCompare(String(a._id || ''));
      }
    });

    return result;
  }, [customers, searchText, statusFilter, sortBy]);

  const kpi = useMemo(() => {
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter((item) => Number(item.active) === 1).length;
    const inactiveCustomers = customers.filter((item) => Number(item.active) === 0).length;
    const lockedCustomers = customers.filter((item) => Number(item.active) === -1).length;

    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      lockedCustomers
    };
  }, [customers]);

  return (
    <LayoutComponent>
      <div className="admin-page-header">
        <h1>Quản lý khách hàng</h1>
        <p>Trang này hiển thị danh sách khách hàng từ MongoDB.</p>
      </div>

      <div className="admin-kpi-grid admin-kpi-grid-4">
        <div className="admin-kpi-card">
          <p>Tổng khách hàng</p>
          <h3>{kpi.totalCustomers}</h3>
        </div>
        <div className="admin-kpi-card">
          <p>Đang hoạt động</p>
          <h3>{kpi.activeCustomers}</h3>
        </div>
        <div className="admin-kpi-card">
          <p>Chưa kích hoạt</p>
          <h3>{kpi.inactiveCustomers}</h3>
        </div>
        <div className="admin-kpi-card">
          <p>Đã khóa</p>
          <h3>{kpi.lockedCustomers}</h3>
        </div>
      </div>

      <div className="admin-customer-toolbar">
        <input
          type="text"
          placeholder="Tìm theo username, tên, số điện thoại, email..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Chưa kích hoạt</option>
          <option value="locked">Đã khóa</option>
        </select>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="newest">Mới nhất</option>
          <option value="nameAsc">Tên A - Z</option>
          <option value="nameDesc">Tên Z - A</option>
          <option value="usernameAsc">Username A - Z</option>
          <option value="usernameDesc">Username Z - A</option>
        </select>

        <button className="admin-reset-filter-btn" onClick={resetFilters}>
          Xóa bộ lọc
        </button>

        <button className="admin-reset-filter-btn" onClick={fetchCustomers}>
          Tải lại danh sách
        </button>
      </div>

      {message && <p className="error-text">{message}</p>}

      {loading ? (
        <div className="admin-empty-box">
          <p>Đang tải dữ liệu khách hàng...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="admin-empty-box">
          <p>Không có khách hàng phù hợp.</p>
        </div>
      ) : (
        <div className="admin-customer-list">
          {filteredCustomers.map((item) => {
            const isOpen = openCustomerId === item._id;
            const activeValue = Number(item.active);

            return (
              <div className="admin-customer-card" key={item._id}>
                <div className="admin-customer-summary">
                  <div className="admin-customer-summary-left">
                    <h3>{item.name || 'Chưa có tên'}</h3>
                    <p><strong>Username:</strong> {item.username || 'Chưa có'}</p>
                    <p><strong>Số điện thoại:</strong> {item.phone || 'Chưa có'}</p>
                    <p><strong>Email:</strong> {item.email || 'Chưa có'}</p>
                  </div>

                  <div className="admin-customer-summary-right">
                    <span className={getStatusClass(item.active)}>
                      {getStatusText(item.active)}
                    </span>

                    <button
                      type="button"
                      className="admin-toggle-btn"
                      onClick={() => toggleDetail(item._id)}
                    >
                      {isOpen ? 'Thu gọn' : 'Xem chi tiết'}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="admin-customer-detail">
                    <hr />

                    <div className="admin-customer-detail-grid">
                      <p><strong>ID:</strong> {item._id}</p>
                      <p><strong>Ngày đăng ký:</strong> {formatDate(item.cdate)}</p>
                      <p><strong>Token kích hoạt:</strong> {item.token || 'Không có'}</p>
                      <p><strong>Trạng thái:</strong> {getStatusText(item.active)}</p>
                    </div>

                    <div className="admin-copy-actions">
                      <button onClick={() => copyText(item.phone, 'số điện thoại')}>
                        Copy SĐT
                      </button>
                      <button onClick={() => copyText(item.email, 'email')}>
                        Copy Email
                      </button>
                      <button onClick={() => goToCustomerOrders(item)}>
                        Xem đơn hàng
                      </button>
                    </div>

                    {canUpdateCustomerStatus && (
                      <div className="admin-customer-actions">
                        {activeValue !== 1 && (
                          <button
                            onClick={() => handleUpdateStatus(item._id, 1)}
                            disabled={updatingId === item._id}
                            className="admin-customer-btn active-btn"
                          >
                            Mở / Kích hoạt
                          </button>
                        )}

                        {activeValue !== -1 && (
                          <button
                            onClick={() => handleUpdateStatus(item._id, -1)}
                            disabled={updatingId === item._id}
                            className="admin-customer-btn lock-btn"
                          >
                            Khóa tài khoản
                          </button>
                        )}

                        {activeValue === -1 && (
                          <button
                            onClick={() => handleUpdateStatus(item._id, 1)}
                            disabled={updatingId === item._id}
                            className="admin-customer-btn unlock-btn"
                          >
                            Mở khóa tài khoản
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </LayoutComponent>
  );
}

export default CustomerAdminComponent;