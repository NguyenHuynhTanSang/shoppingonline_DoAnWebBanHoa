import React, { useEffect, useMemo, useState } from 'react';
import LayoutComponent from '../components/LayoutComponent';
import API from '../services/api';

function CategoryAdminComponent() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [searchText, setSearchText] = useState('');
  const [editingId, setEditingId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    submenus: ['']
  });

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
  const isStaff = role === 'staff';

  const canWriteCategory = isAdmin || isStaff;
  const canDeleteCategory = isAdmin;

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/categories');

      if (res.data && res.data.success) {
        setCategories(res.data.categories || []);
        setMessage('');
      } else {
        setCategories([]);
        setMessage(res.data?.message || 'Không thể tải danh mục');
      }
    } catch (error) {
      console.error(error);
      setCategories([]);
      setMessage(error.response?.data?.message || 'Lỗi tải danh mục');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId('');
    setForm({
      name: '',
      submenus: ['']
    });
    setIsFormOpen(false);
  };

  const handleChangeName = (e) => {
    setForm((prev) => ({
      ...prev,
      name: e.target.value
    }));
  };

  const handleChangeSubmenu = (index, value) => {
    const next = [...form.submenus];
    next[index] = value;
    setForm((prev) => ({
      ...prev,
      submenus: next
    }));
  };

  const handleAddSubmenuInput = () => {
    if (!canWriteCategory) {
      alert('Bạn không có quyền thêm menu con.');
      return;
    }

    setForm((prev) => ({
      ...prev,
      submenus: [...prev.submenus, '']
    }));
  };

  const handleRemoveSubmenuInput = (index) => {
    if (!canWriteCategory) {
      alert('Bạn không có quyền xóa menu con.');
      return;
    }

    const next = form.submenus.filter((_, i) => i !== index);
    setForm((prev) => ({
      ...prev,
      submenus: next.length > 0 ? next : ['']
    }));
  };

  const normalizeSubmenusPayload = (submenus) => {
    return submenus
      .map((name) => ({ name: String(name || '').trim() }))
      .filter((item) => item.name !== '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canWriteCategory) {
      alert('Bạn không có quyền thêm hoặc sửa danh mục.');
      return;
    }

    const payload = {
      name: String(form.name || '').trim(),
      submenus: normalizeSubmenusPayload(form.submenus)
    };

    if (!payload.name) {
      alert('Vui lòng nhập tên danh mục');
      return;
    }

    try {
      if (editingId) {
        const res = await API.put(`/admin/categories/${editingId}`, payload);

        if (res.data && res.data.success) {
          alert('Cập nhật danh mục thành công');
          resetForm();
          fetchCategories();
        } else {
          alert(res.data?.message || 'Không thể cập nhật danh mục');
        }
      } else {
        const res = await API.post('/admin/categories', payload);

        if (res.data && res.data.success) {
          alert('Thêm danh mục thành công');
          resetForm();
          fetchCategories();
        } else {
          alert(res.data?.message || 'Không thể thêm danh mục');
        }
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi xử lý danh mục');
    }
  };

  const handleEdit = (category) => {
    if (!canWriteCategory) {
      alert('Bạn không có quyền sửa danh mục.');
      return;
    }

    setEditingId(category._id);
    setForm({
      name: category.name || '',
      submenus:
        Array.isArray(category.submenus) && category.submenus.length > 0
          ? category.submenus.map((item) => item.name || '')
          : ['']
    });
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (category) => {
    if (!canDeleteCategory) {
      alert('Chỉ admin mới có quyền xóa danh mục.');
      return;
    }

    const ok = window.confirm(
      `Bạn có chắc muốn xóa danh mục "${category.name}" không?`
    );
    if (!ok) return;

    try {
      const res = await API.delete(`/admin/categories/${category._id}`);

      if (res.data && res.data.success) {
        alert('Xóa danh mục thành công');
        if (editingId === category._id) {
          resetForm();
        }
        fetchCategories();
      } else {
        alert(res.data?.message || 'Không thể xóa danh mục');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi xóa danh mục');
    }
  };

  const filteredCategories = useMemo(() => {
    const keyword = String(searchText || '').trim().toLowerCase();
    if (!keyword) return categories;

    return categories.filter((item) => {
      const name = String(item.name || '').toLowerCase();
      const submenuNames = Array.isArray(item.submenus)
        ? item.submenus.map((s) => String(s.name || '').toLowerCase()).join(' ')
        : '';

      return name.includes(keyword) || submenuNames.includes(keyword);
    });
  }, [categories, searchText]);

  const kpi = useMemo(() => {
    const totalCategories = categories.length;
    const totalSubmenus = categories.reduce(
      (sum, item) => sum + Number(item.submenus?.length || 0),
      0
    );

    return {
      totalCategories,
      totalSubmenus
    };
  }, [categories]);

  return (
    <LayoutComponent>
      <div className="admin-page-header">
        <h1>Quản lý danh mục</h1>
        <p>Trang này dùng để xem, thêm và sửa danh mục sản phẩm.</p>
      </div>

      <div className="admin-kpi-grid admin-kpi-grid-2">
        <div className="admin-kpi-card">
          <p>Tổng danh mục</p>
          <h3>{kpi.totalCategories}</h3>
        </div>
        <div className="admin-kpi-card">
          <p>Tổng menu con</p>
          <h3>{kpi.totalSubmenus}</h3>
        </div>
      </div>

      {canWriteCategory && (
        <div className="admin-category-topbar">
          <button
            type="button"
            className="admin-category-toggle-btn"
            onClick={() => {
              if (editingId && isFormOpen) {
                resetForm();
              } else {
                setIsFormOpen((prev) => !prev);
              }
            }}
          >
            {editingId
              ? 'Đóng chỉnh sửa danh mục'
              : isFormOpen
                ? 'Thu gọn form thêm danh mục'
                : '+ Mở form thêm danh mục'}
          </button>
        </div>
      )}

      {canWriteCategory && isFormOpen && (
        <div className="admin-category-form-card compact">
          <div className="admin-category-form-head">
            <div>
              <h3>{editingId ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}</h3>
              <p>
                {editingId
                  ? 'Bạn đang chỉnh sửa danh mục đã chọn.'
                  : 'Nhập tên danh mục và menu con nếu có.'}
              </p>
            </div>

            <button
              type="button"
              className="admin-category-close-btn"
              onClick={resetForm}
            >
              Đóng
            </button>
          </div>

          <form onSubmit={handleSubmit} className="admin-category-form compact-form">
            <div className="admin-category-form-grid">
              <div className="admin-category-form-group">
                <label>Tên danh mục</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={handleChangeName}
                  placeholder="Ví dụ: Hoa sinh nhật"
                />
              </div>
            </div>

            <div className="admin-category-form-group">
              <div className="admin-category-submenu-head">
                <label>Menu con</label>
                <button
                  type="button"
                  className="admin-submenu-add-btn"
                  onClick={handleAddSubmenuInput}
                >
                  + Thêm menu con
                </button>
              </div>

              <div className="admin-submenu-list compact-list">
                {form.submenus.map((submenu, index) => (
                  <div className="admin-submenu-row" key={index}>
                    <input
                      type="text"
                      value={submenu}
                      onChange={(e) => handleChangeSubmenu(index, e.target.value)}
                      placeholder={`Menu con ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="admin-submenu-remove-btn"
                      onClick={() => handleRemoveSubmenuInput(index)}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-category-form-actions">
              <button type="submit" className="admin-primary-btn">
                {editingId ? 'Lưu cập nhật' : 'Thêm danh mục'}
              </button>

              <button
                type="button"
                className="admin-secondary-btn"
                onClick={resetForm}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-category-list-card full-width">
        <div className="admin-category-toolbar compact-toolbar">
          <input
            type="text"
            placeholder="Tìm theo tên danh mục hoặc menu con..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <button className="admin-reset-filter-btn" onClick={() => setSearchText('')}>
            Xóa tìm kiếm
          </button>

          <button className="admin-reset-filter-btn" onClick={fetchCategories}>
            Tải lại danh sách
          </button>
        </div>

        {message && <p className="error-text">{message}</p>}

        {loading ? (
          <div className="admin-empty-box">
            <p>Đang tải dữ liệu danh mục...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="admin-empty-box">
            <p>Không có danh mục phù hợp.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-category-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên danh mục</th>
                  <th>Menu con</th>
                  <th>Số menu con</th>
                  {(canWriteCategory || canDeleteCategory) && <th>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((item) => (
                  <tr key={item._id}>
                    <td className="admin-category-id">{item._id}</td>
                    <td className="admin-category-name">{item.name}</td>
                    <td>
                      {Array.isArray(item.submenus) && item.submenus.length > 0 ? (
                        <div className="admin-category-submenu-tags">
                          {item.submenus.map((submenu) => (
                            <span
                              className="admin-category-submenu-tag"
                              key={submenu._id || submenu.name}
                            >
                              {submenu.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="admin-category-empty-text">Không có menu con</span>
                      )}
                    </td>
                    <td>{item.submenus?.length || 0}</td>

                    {(canWriteCategory || canDeleteCategory) && (
                      <td>
                        <div className="admin-category-actions">
                          {canWriteCategory && (
                            <button
                              className="admin-primary-btn small-btn"
                              onClick={() => handleEdit(item)}
                            >
                              Sửa
                            </button>
                          )}

                          {canDeleteCategory && (
                            <button
                              className="admin-danger-btn small-btn"
                              onClick={() => handleDelete(item)}
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </LayoutComponent>
  );
}

export default CategoryAdminComponent;