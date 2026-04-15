import React, { useEffect, useState } from 'react';
import LayoutComponent from '../components/LayoutComponent';
import API from '../services/api';

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function formatDateTime(timestamp) {
  const value = Number(timestamp || 0);
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN');
}

function toDatetimeLocalValue(timestamp) {
  const value = Number(timestamp || 0);
  if (!value) return '';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');

  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hour = pad(d.getHours());
  const minute = pad(d.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toTimestamp(datetimeLocalValue) {
  if (!datetimeLocalValue) return 0;
  const time = new Date(datetimeLocalValue).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getDefaultForm() {
  return {
    _id: '',
    code: '',
    name: '',
    description: '',
    type: 'fixed',
    value: '',
    minOrderValue: '',
    maxDiscount: '',
    startDate: '',
    endDate: '',
    usageLimit: '',
    usedCount: '',
    isActive: true
  };
}

function VoucherAdminComponent() {
  const [vouchers, setVouchers] = useState([]);
  const [form, setForm] = useState(getDefaultForm());
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const canWriteVoucher = isAdmin || isStaff;
  const canToggleVoucher = isAdmin;
  const canDeleteVoucher = isAdmin;

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      setMessage('');

      const res = await API.get('/admin/vouchers');
      const data = res.data || {};

      if (data.success === false) {
        setMessage(data.message || 'Không tải được danh sách voucher');
        return;
      }

      setVouchers(Array.isArray(data.vouchers) ? data.vouchers : []);
    } catch (err) {
      console.error('FETCH VOUCHERS ERROR:', err);
      setMessage(err.response?.data?.message || 'Lỗi tải danh sách voucher');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(getDefaultForm());
    setEditingId('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEdit = (voucher) => {
    if (!canWriteVoucher) {
      alert('Bạn không có quyền sửa voucher.');
      return;
    }

    setEditingId(voucher._id || '');

    setForm({
      _id: voucher._id || '',
      code: voucher.code || '',
      name: voucher.name || '',
      description: voucher.description || '',
      type: voucher.type || 'fixed',
      value: voucher.value ?? '',
      minOrderValue: voucher.minOrderValue ?? '',
      maxDiscount: voucher.maxDiscount ?? '',
      startDate: toDatetimeLocalValue(voucher.startDate),
      endDate: toDatetimeLocalValue(voucher.endDate),
      usageLimit: voucher.usageLimit ?? '',
      usedCount: voucher.usedCount ?? '',
      isActive: Boolean(voucher.isActive)
    });

    setMessage('Đang ở chế độ chỉnh sửa voucher');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateForm = () => {
    if (!String(form.code || '').trim()) return 'Vui lòng nhập mã voucher';
    if (!String(form.name || '').trim()) return 'Vui lòng nhập tên voucher';
    if (!String(form.value || '').trim()) return 'Vui lòng nhập giá trị giảm';

    const value = Number(form.value || 0);
    const minOrderValue = Number(form.minOrderValue || 0);
    const maxDiscount = Number(form.maxDiscount || 0);
    const usageLimit = Number(form.usageLimit || 0);
    const usedCount = Number(form.usedCount || 0);

    if (value <= 0) return 'Giá trị giảm phải lớn hơn 0';
    if (form.type === 'percent' && value > 100) return 'Voucher phần trăm không được lớn hơn 100';
    if (minOrderValue < 0) return 'Đơn tối thiểu không hợp lệ';
    if (maxDiscount < 0) return 'Giảm tối đa không hợp lệ';
    if (usageLimit < 0) return 'Giới hạn sử dụng không hợp lệ';
    if (usedCount < 0) return 'Số lượt đã dùng không hợp lệ';

    const startDate = toTimestamp(form.startDate);
    const endDate = toTimestamp(form.endDate);

    if (startDate > 0 && endDate > 0 && endDate < startDate) {
      return 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu';
    }

    return '';
  };

  const buildPayload = () => {
    return {
      code: String(form.code || '').trim().toUpperCase(),
      name: String(form.name || '').trim(),
      description: String(form.description || '').trim(),
      type: form.type === 'percent' ? 'percent' : 'fixed',
      value: Number(form.value || 0),
      minOrderValue: Number(form.minOrderValue || 0),
      maxDiscount: form.type === 'percent' ? Number(form.maxDiscount || 0) : 0,
      startDate: toTimestamp(form.startDate),
      endDate: toTimestamp(form.endDate),
      usageLimit: Number(form.usageLimit || 0),
      usedCount: Number(form.usedCount || 0),
      isActive: Boolean(form.isActive)
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canWriteVoucher) {
      setMessage('Bạn không có quyền thêm hoặc sửa voucher');
      return;
    }

    const error = validateForm();
    if (error) {
      setMessage(error);
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      const payload = buildPayload();

      let res;
      if (editingId) {
        res = await API.put(`/admin/vouchers/${editingId}`, payload);
      } else {
        res = await API.post('/admin/vouchers', payload);
      }

      const data = res.data || {};

      if (data.success === false) {
        setMessage(data.message || 'Lưu voucher thất bại');
        return;
      }

      setMessage(editingId ? 'Cập nhật voucher thành công' : 'Thêm voucher thành công');
      resetForm();
      fetchVouchers();
    } catch (err) {
      console.error('SAVE VOUCHER ERROR:', err);
      setMessage(err.response?.data?.message || 'Lỗi lưu voucher');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (voucher) => {
    if (!canDeleteVoucher) {
      alert('Chỉ admin mới có quyền xóa voucher.');
      return;
    }

    const ok = window.confirm(`Bạn có chắc muốn xóa voucher "${voucher.code}" không?`);
    if (!ok) return;

    try {
      const res = await API.delete(`/admin/vouchers/${voucher._id}`);
      const data = res.data || {};

      if (data.success === false) {
        setMessage(data.message || 'Xóa voucher thất bại');
        return;
      }

      setMessage('Xóa voucher thành công');

      if (editingId === voucher._id) {
        resetForm();
      }

      fetchVouchers();
    } catch (err) {
      console.error('DELETE VOUCHER ERROR:', err);
      setMessage(err.response?.data?.message || 'Lỗi xóa voucher');
    }
  };

  const handleToggleStatus = async (voucher) => {
    if (!canToggleVoucher) {
      alert('Chỉ admin mới có quyền bật / tắt voucher.');
      return;
    }

    try {
      const res = await API.put(`/admin/vouchers/${voucher._id}/status`, {
        isActive: !voucher.isActive
      });

      const data = res.data || {};

      if (data.success === false) {
        setMessage(data.message || 'Cập nhật trạng thái thất bại');
        return;
      }

      setMessage('Cập nhật trạng thái voucher thành công');

      if (editingId === voucher._id) {
        setForm((prev) => ({
          ...prev,
          isActive: !voucher.isActive
        }));
      }

      fetchVouchers();
    } catch (err) {
      console.error('TOGGLE VOUCHER STATUS ERROR:', err);
      setMessage(err.response?.data?.message || 'Lỗi cập nhật trạng thái voucher');
    }
  };

  return (
    <LayoutComponent title="Quản lý voucher">
      <div className="admin-page">
        <h2>Quản lý voucher</h2>

        {message && (
          <div
            style={{
              marginBottom: '16px',
              padding: '10px 12px',
              background: '#fff8e1',
              border: '1px solid #f0d98c',
              borderRadius: '8px'
            }}
          >
            {message}
          </div>
        )}

        {canWriteVoucher && (
          <div
            style={{
              background: '#fff',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '24px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              {editingId ? 'Chỉnh sửa voucher' : 'Thêm voucher mới'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div
                className="admin-form-grid"
                style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
              >
                <div>
                  <label>Mã voucher</label>
                  <input
                    type="text"
                    name="code"
                    value={form.code}
                    onChange={handleChange}
                    placeholder="VD: GIAM10"
                  />
                </div>

                <div>
                  <label>Tên voucher</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="VD: Giảm 10% đơn đầu tiên"
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Mô tả</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Mô tả ngắn về voucher"
                  />
                </div>

                <div>
                  <label>Loại voucher</label>
                  <select name="type" value={form.type} onChange={handleChange}>
                    <option value="fixed">Giảm số tiền cố định</option>
                    <option value="percent">Giảm theo phần trăm</option>
                  </select>
                </div>

                <div>
                  <label>Giá trị giảm</label>
                  <input
                    type="number"
                    name="value"
                    value={form.value}
                    onChange={handleChange}
                    min="0"
                    placeholder={form.type === 'percent' ? 'VD: 10' : 'VD: 50000'}
                  />
                </div>

                <div>
                  <label>Đơn tối thiểu</label>
                  <input
                    type="number"
                    name="minOrderValue"
                    value={form.minOrderValue}
                    onChange={handleChange}
                    min="0"
                    placeholder="VD: 200000"
                  />
                </div>

                <div>
                  <label>Giảm tối đa (chỉ dùng cho %)</label>
                  <input
                    type="number"
                    name="maxDiscount"
                    value={form.maxDiscount}
                    onChange={handleChange}
                    min="0"
                    disabled={form.type !== 'percent'}
                    placeholder="VD: 100000"
                  />
                </div>

                <div>
                  <label>Ngày bắt đầu</label>
                  <input
                    type="datetime-local"
                    name="startDate"
                    value={form.startDate}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>Ngày kết thúc</label>
                  <input
                    type="datetime-local"
                    name="endDate"
                    value={form.endDate}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>Giới hạn sử dụng</label>
                  <input
                    type="number"
                    name="usageLimit"
                    value={form.usageLimit}
                    onChange={handleChange}
                    min="0"
                    placeholder="0 = không giới hạn"
                  />
                </div>

                <div>
                  <label>Số lượt đã dùng</label>
                  <input
                    type="number"
                    name="usedCount"
                    value={form.usedCount}
                    onChange={handleChange}
                    min="0"
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={form.isActive}
                      onChange={handleChange}
                    />
                    Kích hoạt voucher
                  </label>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button type="submit" disabled={saving}>
                  {saving ? 'Đang lưu...' : editingId ? 'Cập nhật voucher' : 'Thêm voucher'}
                </button>

                <button type="button" onClick={resetForm}>
                  Làm mới
                </button>
              </div>
            </form>
          </div>
        )}

        <div
          style={{
            background: '#fff',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <h3 style={{ margin: 0 }}>Danh sách voucher</h3>
            <button type="button" onClick={fetchVouchers} disabled={loading}>
              {loading ? 'Đang tải...' : 'Tải lại'}
            </button>
          </div>

          {loading ? (
            <p>Đang tải dữ liệu...</p>
          ) : vouchers.length === 0 ? (
            <p>Chưa có voucher nào.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Tên</th>
                    <th>Loại</th>
                    <th>Giá trị</th>
                    <th>Đơn tối thiểu</th>
                    <th>Giảm tối đa</th>
                    <th>Lượt dùng</th>
                    <th>Thời gian</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => {
                    const isPercent = voucher.type === 'percent';
                    const statusText = voucher.isActive ? 'Đang bật' : 'Đang tắt';

                    return (
                      <tr key={voucher._id}>
                        <td>{voucher.code}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{voucher.name}</div>
                          {voucher.description ? (
                            <div style={{ fontSize: '13px', color: '#666' }}>
                              {voucher.description}
                            </div>
                          ) : null}
                        </td>
                        <td>{isPercent ? 'Phần trăm' : 'Cố định'}</td>
                        <td>
                          {isPercent
                            ? `${Number(voucher.value || 0)}%`
                            : `${formatMoney(voucher.value)} đ`}
                        </td>
                        <td>{formatMoney(voucher.minOrderValue)} đ</td>
                        <td>
                          {isPercent && Number(voucher.maxDiscount || 0) > 0
                            ? `${formatMoney(voucher.maxDiscount)} đ`
                            : '-'}
                        </td>
                        <td>
                          {Number(voucher.usedCount || 0)} /{' '}
                          {Number(voucher.usageLimit || 0) > 0
                            ? Number(voucher.usageLimit || 0)
                            : '∞'}
                        </td>
                        <td>
                          <div>Bắt đầu: {formatDateTime(voucher.startDate) || '-'}</div>
                          <div>Kết thúc: {formatDateTime(voucher.endDate) || '-'}</div>
                        </td>
                        <td>{statusText}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {canWriteVoucher && (
                              <button type="button" onClick={() => handleEdit(voucher)}>
                                Sửa
                              </button>
                            )}

                            {canToggleVoucher && (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(voucher)}
                              >
                                {voucher.isActive ? 'Khóa' : 'Mở'}
                              </button>
                            )}

                            {canDeleteVoucher && (
                              <button
                                type="button"
                                onClick={() => handleDelete(voucher)}
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </LayoutComponent>
  );
}

export default VoucherAdminComponent;