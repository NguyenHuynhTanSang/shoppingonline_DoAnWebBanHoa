import React, { useCallback, useEffect, useMemo, useState } from 'react';
import LayoutComponent from '../components/LayoutComponent';
import API from '../services/api';

const DEFAULT_FORM = {
  username: '',
  password: '',
  name: '',
  phone: '',
  email: '',
  active: 1
};

function StaffAdminComponent() {
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [togglingId, setTogglingId] = useState('');

  let currentUser = null;
  try {
    currentUser =
      JSON.parse(localStorage.getItem('adminUser') || 'null') ||
      JSON.parse(localStorage.getItem('admin') || 'null');
  } catch (error) {
    currentUser = null;
  }

  const currentRole = currentUser?.role || localStorage.getItem('adminRole') || '';
  const isAdmin = currentRole === 'admin';

  const fetchStaffs = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');

      const res = await API.get('/admin/staffs');

      if (res.data && res.data.success) {
        setStaffs(res.data.staffs || []);
        setMessage('');
      } else {
        setStaffs([]);
        setMessage(res.data?.message || 'Không thể tải danh sách nhân viên');
      }
    } catch (error) {
      console.error(error);

      const apiMessage = error.response?.data?.message || '';
      const status = error.response?.status;

      if (
        status === 403 ||
        apiMessage === 'Forbidden: insufficient permission' ||
        apiMessage.toLowerCase().includes('forbidden')
      ) {
        setMessage('Bạn không có quyền truy cập trang quản lý nhân viên.');
      } else {
        setMessage(apiMessage || 'Không thể tải danh sách nhân viên');
      }

      setStaffs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffs();
  }, [fetchStaffs]);

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingStaff(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    if (!isAdmin) {
      alert('Bạn không có quyền thêm nhân viên.');
      return;
    }

    setEditingStaff(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  };

  const openEditForm = (staff) => {
    if (!isAdmin) {
      alert('Bạn không có quyền sửa nhân viên.');
      return;
    }

    setEditingStaff(staff);
    setForm({
      username: staff.username || '',
      password: staff.password || '',
      name: staff.name || '',
      phone: staff.phone || '',
      email: staff.email || '',
      active: Number(staff.active ?? 1)
    });
    setShowForm(true);
  };

  const handleChangeForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      alert('Bạn không có quyền thực hiện chức năng này.');
      return;
    }

    const payload = {
      username: String(form.username || '').trim(),
      password: String(form.password || '').trim(),
      name: String(form.name || '').trim(),
      phone: String(form.phone || '').trim(),
      email: String(form.email || '').trim(),
      active: Number(form.active ?? 1)
    };

    if (!payload.username || !payload.password || !payload.name) {
      alert('Vui lòng nhập username, password và tên nhân viên');
      return;
    }

    try {
      setSaving(true);

      let res;
      if (editingStaff?._id) {
        res = await API.put(`/admin/staffs/${editingStaff._id}`, payload);
      } else {
        res = await API.post('/admin/staff', payload);
      }

      if (res.data && res.data.success) {
        alert(editingStaff ? 'Cập nhật nhân viên thành công' : 'Thêm nhân viên thành công');
        resetForm();
        await fetchStaffs();
      } else {
        alert(res.data?.message || 'Không thể lưu nhân viên');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi lưu nhân viên');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (staff) => {
    if (!isAdmin) {
      alert('Bạn không có quyền cập nhật trạng thái nhân viên.');
      return;
    }

    const nextActive = Number(staff.active) === 1 ? 0 : 1;
    const text = nextActive === 1 ? 'mở lại' : 'khóa';

    const ok = window.confirm(`Bạn có chắc muốn ${text} tài khoản "${staff.username}" không?`);
    if (!ok) return;

    try {
      setTogglingId(staff._id);

      const res = await API.put(`/admin/staffs/${staff._id}/status`, {
        active: nextActive
      });

      if (res.data && res.data.success) {
        alert('Cập nhật trạng thái nhân viên thành công');
        await fetchStaffs();
      } else {
        alert(res.data?.message || 'Không thể cập nhật trạng thái');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi cập nhật trạng thái');
    } finally {
      setTogglingId('');
    }
  };

  const handleDeleteStaff = async (staff) => {
    if (!isAdmin) {
      alert('Bạn không có quyền xóa nhân viên.');
      return;
    }

    const ok = window.confirm(`Bạn có chắc muốn xóa nhân viên "${staff.username}" không?`);
    if (!ok) return;

    try {
      setDeletingId(staff._id);

      const res = await API.delete(`/admin/staffs/${staff._id}`);

      if (res.data && res.data.success) {
        alert('Xóa nhân viên thành công');
        await fetchStaffs();
      } else {
        alert(res.data?.message || 'Không thể xóa nhân viên');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi xóa nhân viên');
    } finally {
      setDeletingId('');
    }
  };

  const filteredStaffs = useMemo(() => {
    let result = [...staffs];
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
      result = result.filter((item) => {
        const active = Number(item.active ?? 1);
        if (statusFilter === 'active') return active === 1;
        if (statusFilter === 'locked') return active !== 1;
        return true;
      });
    }

    result.sort((a, b) => Number(b.cdate || 0) - Number(a.cdate || 0));
    return result;
  }, [staffs, searchText, statusFilter]);

  const kpi = useMemo(() => {
    return {
      total: staffs.length,
      active: staffs.filter((s) => Number(s.active ?? 1) === 1).length,
      locked: staffs.filter((s) => Number(s.active ?? 1) !== 1).length
    };
  }, [staffs]);

  return (
    <LayoutComponent>
      <div className="admin-page-header">
        <h1>Quản lý nhân viên</h1>
        <p>Quản lý danh sách nhân viên, trạng thái hoạt động và thông tin tài khoản.</p>
      </div>

      {isAdmin && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
          <button className="admin-reset-filter-btn" onClick={openCreateForm}>
            + Thêm nhân viên
          </button>
          <button className="admin-reset-filter-btn" onClick={fetchStaffs}>
            Tải lại danh sách
          </button>
        </div>
      )}

      {showForm && isAdmin && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#fff',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '18px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)'
          }}
        >
          <h3 style={{ marginBottom: '16px' }}>
            {editingStaff ? 'Cập nhật nhân viên' : 'Thêm nhân viên mới'}
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '14px'
            }}
          >
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) => handleChangeForm('username', e.target.value)}
            />

            <input
              type="text"
              placeholder="Password"
              value={form.password}
              onChange={(e) => handleChangeForm('password', e.target.value)}
            />

            <input
              type="text"
              placeholder="Tên nhân viên"
              value={form.name}
              onChange={(e) => handleChangeForm('name', e.target.value)}
            />

            <input
              type="text"
              placeholder="Số điện thoại"
              value={form.phone}
              onChange={(e) => handleChangeForm('phone', e.target.value)}
            />

            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => handleChangeForm('email', e.target.value)}
            />

            <select
              value={form.active}
              onChange={(e) => handleChangeForm('active', Number(e.target.value))}
            >
              <option value={1}>Đang hoạt động</option>
              <option value={0}>Đã khóa</option>
            </select>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : editingStaff ? 'Lưu cập nhật' : 'Thêm nhân viên'}
            </button>

            <button type="button" onClick={resetForm}>
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <p>Tổng nhân viên</p>
          <h3>{kpi.total}</h3>
        </div>
        <div className="admin-kpi-card">
          <p>Đang hoạt động</p>
          <h3>{kpi.active}</h3>
        </div>
        <div className="admin-kpi-card">
          <p>Đã khóa</p>
          <h3>{kpi.locked}</h3>
        </div>
      </div>

      <div className="admin-order-toolbar">
        <input
          type="text"
          placeholder="Tìm theo username, tên, số điện thoại, email..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="locked">Đã khóa</option>
        </select>

        {isAdmin && (
          <button className="admin-reset-filter-btn" onClick={fetchStaffs}>
            Tải lại
          </button>
        )}
      </div>

      {message && <p className="error-text">{message}</p>}

      {loading && staffs.length === 0 ? (
        <div className="admin-empty-box">
          <p>Đang tải dữ liệu...</p>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Tên</th>
              <th>SĐT</th>
              <th>Email</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Ngày cập nhật</th>
              {isAdmin && <th>Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {filteredStaffs.length > 0 ? (
              filteredStaffs.map((item) => (
                <tr key={item._id}>
                  <td>{item.username}</td>
                  <td>{item.name || ''}</td>
                  <td>{item.phone || ''}</td>
                  <td>{item.email || ''}</td>
                  <td>
                    <span
                      style={{
                        padding: '6px 10px',
                        borderRadius: '999px',
                        fontWeight: 600,
                        background: Number(item.active ?? 1) === 1 ? '#e8f5e9' : '#ffebee',
                        color: Number(item.active ?? 1) === 1 ? '#2e7d32' : '#c62828'
                      }}
                    >
                      {Number(item.active ?? 1) === 1 ? 'Đang hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td>
                    {item.cdate ? new Date(Number(item.cdate)).toLocaleString('vi-VN') : ''}
                  </td>
                  <td>
                    {item.udate ? new Date(Number(item.udate)).toLocaleString('vi-VN') : ''}
                  </td>

                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={() => openEditForm(item)}>Sửa</button>

                        <button
                          onClick={() => handleToggleStatus(item)}
                          disabled={togglingId === item._id}
                        >
                          {togglingId === item._id
                            ? 'Đang xử lý...'
                            : Number(item.active ?? 1) === 1
                            ? 'Khóa'
                            : 'Mở'}
                        </button>

                        <button
                          onClick={() => handleDeleteStaff(item)}
                          disabled={deletingId === item._id}
                          style={{
                            background: '#e53935',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          {deletingId === item._id ? 'Đang xóa...' : 'Xóa'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isAdmin ? 8 : 7}>Không có nhân viên phù hợp</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </LayoutComponent>
  );
}

export default StaffAdminComponent;