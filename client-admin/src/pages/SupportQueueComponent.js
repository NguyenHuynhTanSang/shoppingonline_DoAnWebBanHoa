import React, { useEffect, useState } from 'react';
import API from '../services/api';
import LayoutComponent from '../components/LayoutComponent';
import './SupportQueueComponent.css';
import HumanSupportChat from '../components/HumanSupportChat';

const statuses = { pending: 'Chờ xử lý', in_progress: 'Đang xử lý', resolved: 'Đã giải quyết' };
const categories = { wrong_product: 'Giao sai sản phẩm', damaged_product: 'Hư hỏng', refund: 'Hoàn tiền', delivery: 'Giao hàng', payment: 'Thanh toán', staff: 'Gặp nhân viên', order_change: 'Thay đổi đơn' };
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString('vi-VN') : '—';
const customer = value => value?.name || value?.username || value?._id || 'Khách hàng không còn tồn tại';

export default function SupportQueueComponent() {
  const [filters, setFilters] = useState({ status: 'pending', category: '', search: '', sort: 'newest', page: 1 });
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ requests: [], stats: {}, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('wf:support-refresh', refresh);
    return () => window.removeEventListener('wf:support-refresh', refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    API.get('/admin/support-requests', { params: filters, signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      if (!response.data.success) throw new Error();
      setData(response.data);
    }).catch(() => { if (!controller.signal.aborted) setError('Không tải được yêu cầu hỗ trợ. Vui lòng thử lại.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, revision]);
  const filter = (key, value) => { setDetail(null); setFilters(previous => ({ ...previous, [key]: value, page: 1 })); };
  async function show(id) {
    setBusy(true); setError('');
    try { const response = await API.get(`/admin/support-requests/${id}`); setDetail(response.data.request); }
    catch { setError('Không tải được chi tiết yêu cầu.'); }
    finally { setBusy(false); }
  }
  async function update(item) {
    setBusy(true); setError('');
    try {
      await API.patch(`/admin/support-requests/${item._id}/status`, { status: item.status === 'pending' ? 'in_progress' : 'resolved' });
      setDetail(null); setRevision(value => value + 1);
    } catch { setError('Không cập nhật được trạng thái. Có thể yêu cầu đã thay đổi; hãy tải lại.'); }
    finally { setBusy(false); }
  }
  const action = item => item.status !== 'resolved' && <button disabled={busy || loading} onClick={() => update(item)}>
    {item.status === 'pending' ? 'Tiếp nhận' : 'Đánh dấu đã giải quyết'}</button>;
  return <LayoutComponent><div className="support-queue">
    <h1>AI &amp; Hỗ trợ</h1>
    <div className="admin-kpi-grid">{Object.entries({ total: 'Tổng yêu cầu', ...statuses }).map(([key, label]) =>
      <div className="admin-kpi-card" key={key}><span>{label}</span><strong>{data.stats[key] ?? 0}</strong></div>)}</div>
    <div className="support-filters">
      <label>Trạng thái <select value={filters.status} onChange={event => filter('status', event.target.value)}>
        <option value="">Tất cả</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Lý do <select value={filters.category} onChange={event => filter('category', event.target.value)}>
        <option value="">Tất cả</option>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Sắp xếp <select value={filters.sort} onChange={event => filter('sort', event.target.value)}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option></select></label>
      <form onSubmit={event => { event.preventDefault(); filter('search', search.trim()); }}>
        <input aria-label="Tìm mã yêu cầu, khách hàng, mã đơn" placeholder="Mã yêu cầu / khách / mã đơn" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /><button>Tìm</button>
      </form><button disabled={busy} onClick={() => setRevision(value => value + 1)}>Tải lại</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Đang tải yêu cầu hỗ trợ…</p> : !error && <>
      {!data.requests.length ? <p>Hiện không có yêu cầu hỗ trợ.</p> : <div className="support-table"><table><thead><tr>
        {['ID yêu cầu', 'Khách hàng', 'Lý do / Nội dung', 'Mã đơn', 'Trạng thái', 'Ngày tạo', 'Người xử lý', 'Thao tác'].map(label => <th key={label}>{label}</th>)}
      </tr></thead><tbody>{data.requests.map(item => <tr key={item._id}>
        <td>{item._id}</td><td>{customer(item.customerId)}</td><td>{categories[item.category] || item.category}<p>{item.customerMessage}</p></td>
        <td>{item.orderId || '—'}</td><td><span className={`support-badge ${item.status}`}>{statuses[item.status] || item.status}</span></td>
        <td>{date(item.createdAt)}</td><td>{item.assignedTo?.name || 'Chưa tiếp nhận'}</td>
        <td><button disabled={busy} onClick={() => show(item._id)}>Xem chi tiết</button>{action(item)}</td>
      </tr>)}</tbody></table></div>}
      <div className="support-filters"><button disabled={filters.page <= 1} onClick={() => setFilters(previous => ({ ...previous, page: previous.page - 1 }))}>Trang trước</button>
        <span>Trang {filters.page} · {data.total} yêu cầu</span>
        <button disabled={filters.page * 25 >= data.total} onClick={() => setFilters(previous => ({ ...previous, page: previous.page + 1 }))}>Trang sau</button></div>
    </>}
    {detail && <section aria-label="Chi tiết yêu cầu" className="support-detail">
      <h2>Chi tiết #{detail._id}</h2><button onClick={() => setDetail(null)}>Đóng chi tiết</button>
      <p>Khách hàng: {customer(detail.customerId)}</p><p>Email: {detail.customerId?.email || '—'} · SĐT: {detail.customerId?.phone || '—'}</p>
      <p>Lý do: {categories[detail.category] || detail.category}</p><p className="support-message">{detail.customerMessage}</p>
      <p>Mã đơn: {detail.orderId || '—'}</p><p>Trạng thái: {statuses[detail.status]}</p>
      <p>Ngày tạo: {date(detail.createdAt)} · Cập nhật: {date(detail.updatedAt)}</p>
      <p>Người xử lý: {detail.assignedTo?.name || 'Chưa tiếp nhận'} {detail.assignedTo?.role || ''}</p>{action(detail)}
      <h3>Trò chuyện với khách hàng</h3>
      <HumanSupportChat requestId={detail._id} tokenKey="adminToken" />
    </section>}
  </div></LayoutComponent>;
}
