import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API from '../services/api';
import LayoutComponent from '../components/LayoutComponent';

function OrderAdminComponent() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openOrderId, setOpenOrderId] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);

  const [searchText, setSearchText] = useState(() => {
    return localStorage.getItem('adminOrderCustomerKeyword') || '';
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [noteFilter, setNoteFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [bulkStatus, setBulkStatus] = useState('approved');

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState({
    orderId: '',
    to: '',
    subject: '',
    body: ''
  });

  const resetFilters = () => {
    setSearchText('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setNoteFilter('all');
    setDateFilter('all');
    setSortBy('newest');
    localStorage.removeItem('adminOrderCustomerKeyword');
  };

  const normalizeStatus = (status) => String(status || '').toLowerCase();

  const isCanceledOrder = (orderOrStatus) => {
    if (typeof orderOrStatus === 'string') {
      return normalizeStatus(orderOrStatus) === 'canceled';
    }
    return normalizeStatus(orderOrStatus?.status) === 'canceled';
  };

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/orders');

      if (res.data && res.data.success) {
        const data = res.data.orders || [];
        setOrders(data);

        const initStatuses = {};
        data.forEach((order) => {
          initStatuses[order._id] = order.status || 'pending';
        });
        setSelectedStatuses(initStatuses);
      } else {
        setOrders([]);
        alert(res.data?.message || 'Không tải được danh sách đơn hàng.');
      }
    } catch (err) {
      console.error('Load orders error:', err);
      setOrders([]);
      alert(err.response?.data?.message || 'Lỗi tải đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const savedKeyword = localStorage.getItem('adminOrderCustomerKeyword');
    if (savedKeyword) {
      setSearchText(savedKeyword);
      localStorage.removeItem('adminOrderCustomerKeyword');
    }
  }, []);

  const toggleOrder = (orderId) => {
    setOpenOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const getStatusText = (status) => {
    switch (normalizeStatus(status)) {
      case 'pending':
        return 'Chờ xác nhận';
      case 'approved':
        return 'Đã xác nhận';
      case 'preparing':
        return 'Đang chuẩn bị';
      case 'delivering':
        return 'Đang giao hàng';
      case 'completed':
        return 'Hoàn thành';
      case 'canceled':
        return 'Đã hủy';
      default:
        return 'Chờ xử lý';
    }
  };

  const getStatusClass = (status) => {
    switch (normalizeStatus(status)) {
      case 'pending':
        return 'admin-order-status pending';
      case 'approved':
        return 'admin-order-status approved';
      case 'preparing':
        return 'admin-order-status preparing';
      case 'delivering':
        return 'admin-order-status delivering';
      case 'completed':
        return 'admin-order-status completed';
      case 'canceled':
        return 'admin-order-status canceled';
      default:
        return 'admin-order-status';
    }
  };

  const formatPaymentMethod = (paymentMethod) => {
    switch (paymentMethod) {
      case 'cod':
        return 'Thanh toán khi nhận hàng';
      case 'bank':
        return 'Chuyển khoản ngân hàng';
      case 'momo':
        return 'Ví điện tử MoMo';
      default:
        return 'Chưa có';
    }
  };

  const getPaymentBadgeClass = (paymentMethod) => {
    switch (paymentMethod) {
      case 'cod':
        return 'admin-mini-badge cod';
      case 'bank':
        return 'admin-mini-badge bank';
      case 'momo':
        return 'admin-mini-badge momo';
      default:
        return 'admin-mini-badge';
    }
  };

  const formatDate = (cdate) => {
    if (!cdate) return 'Chưa có';
    try {
      return new Date(Number(cdate)).toLocaleString('vi-VN');
    } catch {
      return 'Chưa có';
    }
  };

  const formatMoney = (value) => {
    return Number(value || 0).toLocaleString('vi-VN') + ' đ';
  };

  const handleStatusChange = (orderId, newStatus) => {
    const targetOrder = orders.find((item) => item._id === orderId);

    if (isCanceledOrder(targetOrder)) {
      alert('Đơn hàng đã hủy không thể cập nhật trạng thái nữa.');
      return;
    }

    setSelectedStatuses((prev) => ({
      ...prev,
      [orderId]: newStatus
    }));
  };

  const handleSaveStatus = async (orderId) => {
    try {
      const targetOrder = orders.find((item) => item._id === orderId);
      const currentStatus = normalizeStatus(targetOrder?.status);
      const newStatus = normalizeStatus(selectedStatuses[orderId] || 'pending');

      if (!targetOrder) {
        alert('Không tìm thấy đơn hàng.');
        return;
      }

      if (currentStatus === 'canceled') {
        alert('Đơn hàng đã hủy không thể cập nhật trạng thái nữa.');
        return;
      }

      if (currentStatus === newStatus) {
        alert('Trạng thái đơn hàng không thay đổi.');
        return;
      }

      if (newStatus === 'canceled') {
        const ok = window.confirm('Bạn có chắc muốn hủy đơn hàng này không?');
        if (!ok) return;
      }

      const res = await API.put(`/admin/orders/${orderId}/status`, {
        status: newStatus
      });

      if (res.data && res.data.success) {
        alert('Cập nhật trạng thái đơn hàng thành công!');
        loadOrders();
      } else {
        alert(res.data?.message || 'Cập nhật trạng thái thất bại.');
      }
    } catch (err) {
      console.error('Update status error:', err);
      alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái đơn hàng.');
    }
  };

  const handleBulkUpdateStatus = async () => {
    try {
      if (selectedIds.length === 0) {
        alert('Vui lòng chọn ít nhất 1 đơn hàng.');
        return;
      }

      const selectedOrders = orders.filter((order) => selectedIds.includes(order._id));
      const canceledOrders = selectedOrders.filter((order) => isCanceledOrder(order));

      if (canceledOrders.length > 0) {
        alert('Trong danh sách đã chọn có đơn đã hủy. Vui lòng bỏ chọn các đơn đã hủy.');
        return;
      }

      let confirmMessage = `Bạn có chắc muốn cập nhật ${selectedIds.length} đơn sang trạng thái "${getStatusText(
        bulkStatus
      )}" không?`;

      if (bulkStatus === 'canceled') {
        confirmMessage = `Bạn có chắc muốn HỦY ${selectedIds.length} đơn hàng đã chọn không?`;
      }

      const ok = window.confirm(confirmMessage);
      if (!ok) return;

      await Promise.all(
        selectedIds.map((id) =>
          API.put(`/admin/orders/${id}/status`, { status: bulkStatus })
        )
      );

      alert('Cập nhật trạng thái hàng loạt thành công!');
      setSelectedIds([]);
      loadOrders();
    } catch (err) {
      console.error('Bulk update error:', err);
      alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái hàng loạt.');
    }
  };

  const toggleSelectOne = (orderId) => {
    const targetOrder = orders.find((item) => item._id === orderId);

    if (isCanceledOrder(targetOrder)) {
      alert('Đơn hàng đã hủy không nên chọn để xử lý hàng loạt.');
      return;
    }

    setSelectedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const copyText = async (text, label = 'Dữ liệu') => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      alert(`Đã copy ${label}`);
    } catch (err) {
      console.error('Copy error:', err);
      alert(`Không thể copy ${label}`);
    }
  };

  const isMatchDateFilter = useCallback((orderDate, filterType) => {
    if (!orderDate || filterType === 'all') return true;

    const now = new Date();

    const startOfDay = (date) => {
      const d = new Date(date);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    const addDays = (date, days) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    };

    const todayStart = startOfDay(now);
    const tomorrowStart = addDays(todayStart, 1);
    const yesterdayStart = addDays(todayStart, -1);

    const last7Start = addDays(todayStart, -6);
    const last14Start = addDays(todayStart, -13);
    const last30Start = addDays(todayStart, -29);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (filterType) {
      case 'today':
        return orderDate >= todayStart && orderDate < tomorrowStart;
      case 'yesterday':
        return orderDate >= yesterdayStart && orderDate < todayStart;
      case 'last7':
        return orderDate >= last7Start && orderDate < tomorrowStart;
      case 'last14':
        return orderDate >= last14Start && orderDate < tomorrowStart;
      case 'last30':
        return orderDate >= last30Start && orderDate < tomorrowStart;
      case 'thisMonth':
        return orderDate >= thisMonthStart && orderDate < nextMonthStart;
      case 'lastMonth':
        return orderDate >= lastMonthStart && orderDate < lastMonthEnd;
      default:
        return true;
    }
  }, []);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    const keyword = searchText.trim().toLowerCase();

    if (keyword) {
      result = result.filter((order) => {
        const orderId = String(order._id || '').toLowerCase();
        const customerName = String(
          order.customerInfo?.fullName || order.customer?.name || ''
        ).toLowerCase();
        const phone = String(
          order.customerInfo?.phone || order.customer?.phone || ''
        ).toLowerCase();
        const email = String(
          order.customerInfo?.email || order.customer?.email || ''
        ).toLowerCase();

        return (
          orderId.includes(keyword) ||
          customerName.includes(keyword) ||
          phone.includes(keyword) ||
          email.includes(keyword)
        );
      });
    }

    if (statusFilter !== 'all') {
      result = result.filter((order) => normalizeStatus(order.status) === statusFilter);
    }

    if (paymentFilter !== 'all') {
      result = result.filter(
        (order) => (order.customerInfo?.paymentMethod || '') === paymentFilter
      );
    }

    if (noteFilter === 'hasNote') {
      result = result.filter((order) =>
        String(order.customerInfo?.note || '').trim()
      );
    }

    if (noteFilter === 'noNote') {
      result = result.filter(
        (order) => !String(order.customerInfo?.note || '').trim()
      );
    }

    if (dateFilter !== 'all') {
      result = result.filter((order) => {
        const orderDate = order.cdate ? new Date(Number(order.cdate)) : null;
        return isMatchDateFilter(orderDate, dateFilter);
      });
    }

    result.sort((a, b) => {
      const timeA = Number(a.cdate || 0);
      const timeB = Number(b.cdate || 0);
      const totalA = Number(a.total || 0);
      const totalB = Number(b.total || 0);

      switch (sortBy) {
        case 'oldest':
          return timeA - timeB;
        case 'totalDesc':
          return totalB - totalA;
        case 'totalAsc':
          return totalA - totalB;
        case 'newest':
        default:
          return timeB - timeA;
      }
    });

    return result;
  }, [
    orders,
    searchText,
    statusFilter,
    paymentFilter,
    noteFilter,
    dateFilter,
    sortBy,
    isMatchDateFilter
  ]);

  const selectableFilteredOrders = useMemo(() => {
    return filteredOrders.filter((order) => !isCanceledOrder(order));
  }, [filteredOrders]);

  const allFilteredSelected =
    selectableFilteredOrders.length > 0 &&
    selectableFilteredOrders.every((order) => selectedIds.includes(order._id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !selectableFilteredOrders.some((o) => o._id === id))
      );
    } else {
      const filteredIds = selectableFilteredOrders.map((o) => o._id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const kpi = useMemo(() => {
    const totalOrders = orders.length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const approved = orders.filter((o) => o.status === 'approved').length;
    const preparing = orders.filter((o) => o.status === 'preparing').length;
    const delivering = orders.filter((o) => o.status === 'delivering').length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    const canceled = orders.filter((o) => o.status === 'canceled').length;

    const revenueCompleted = orders
      .filter((o) => o.status === 'completed')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const revenueAll = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    return {
      totalOrders,
      pending,
      approved,
      preparing,
      delivering,
      completed,
      canceled,
      revenueCompleted,
      revenueAll
    };
  }, [orders]);

  const renderTimeline = (status) => {
    const steps = [
      { key: 'pending', label: 'Chờ xác nhận' },
      { key: 'approved', label: 'Đã xác nhận' },
      { key: 'preparing', label: 'Đang chuẩn bị' },
      { key: 'delivering', label: 'Đang giao' },
      { key: 'completed', label: 'Hoàn thành' }
    ];

    const currentIndexMap = {
      pending: 0,
      approved: 1,
      preparing: 2,
      delivering: 3,
      completed: 4
    };

    const currentIndex = currentIndexMap[status] ?? 0;
    const isCanceled = status === 'canceled';

    return (
      <div className="admin-order-timeline">
        {steps.map((step, index) => {
          const isActive = !isCanceled && index <= currentIndex;
          return (
            <div
              key={step.key}
              className={`timeline-step ${isActive ? 'active' : ''}`}
            >
              <div className="timeline-dot" />
              <span>{step.label}</span>
            </div>
          );
        })}

        {isCanceled && (
          <div className="timeline-step canceled active">
            <div className="timeline-dot" />
            <span>Đã hủy</span>
          </div>
        )}
      </div>
    );
  };

  const buildEmailDraft = (order) => {
    const customerName =
      order.customerInfo?.fullName || order.customer?.name || 'Quý khách';
    const customerEmail =
      order.customerInfo?.email || order.customer?.email || '';
    const customerPhone = order.customerInfo?.phone || order.customer?.phone || '';
    const customerAddress = order.customerInfo?.address || '';
    const paymentMethod = formatPaymentMethod(order.customerInfo?.paymentMethod || '');
    const statusText = getStatusText(order.status);
    const orderDate = formatDate(order.cdate);
    const voucherCode = order.voucherCode || 'Không có';

    const itemsText = (order.items || [])
      .map((item, index) => {
        const product = item.product || {};
        return `- ${index + 1}. ${product.name || 'Sản phẩm'} | SL: ${
          item.quantity || 0
        } | Thành tiền: ${formatMoney(
          Number(product.price || 0) * Number(item.quantity || 0)
        )}`;
      })
      .join('\n');

    const subject = `[WIND FLOWER] Cập nhật đơn hàng ${order._id}`;

    const body = `Xin chào ${customerName},

Shop WIND FLOWER gửi bạn thông tin đơn hàng như sau:

Mã đơn: ${order._id}
Ngày đặt: ${orderDate}
Trạng thái đơn hàng: ${statusText}
Phương thức thanh toán: ${paymentMethod}
Số điện thoại: ${customerPhone || 'Chưa có'}
Địa chỉ nhận hàng: ${customerAddress || 'Chưa có'}
Mã giảm giá: ${voucherCode}
Tổng tiền: ${formatMoney(order.total)}

Danh sách sản phẩm:
${itemsText || '- Chưa có thông tin sản phẩm'}

Lời nhắn từ khách:
${String(order.customerInfo?.note || '').trim() || 'Không có'}

Nếu bạn cần hỗ trợ thêm, vui lòng phản hồi email này hoặc liên hệ shop.

Trân trọng,
WIND FLOWER`;

    return {
      orderId: order._id,
      to: customerEmail,
      subject,
      body
    };
  };

  const openEmailModal = (order) => {
    const draft = buildEmailDraft(order);

    if (!draft.to) {
      alert('Đơn hàng này chưa có email khách hàng để liên hệ.');
      return;
    }

    setEmailDraft(draft);
    setEmailModalOpen(true);
  };

  const closeEmailModal = () => {
    setEmailModalOpen(false);
    setEmailDraft({
      orderId: '',
      to: '',
      subject: '',
      body: ''
    });
  };

  const handleEmailDraftChange = (e) => {
    const { name, value } = e.target;
    setEmailDraft((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const openGmailCompose = () => {
    if (!emailDraft.to.trim()) {
      alert('Chưa có email người nhận.');
      return;
    }

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      emailDraft.to
    )}&su=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(
      emailDraft.body
    )}`;

    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <LayoutComponent>
      <div className="admin-order-page">
        <div className="admin-page-header">
          <h1>Quản lý đơn hàng</h1>
          <p>Hiển thị danh sách đơn hàng và cập nhật trạng thái xử lý.</p>
        </div>

        <div className="admin-kpi-grid">
          <div className="admin-kpi-card">
            <p>Tổng đơn</p>
            <h3>{kpi.totalOrders}</h3>
          </div>
          <div className="admin-kpi-card">
            <p>Chờ xác nhận</p>
            <h3>{kpi.pending}</h3>
          </div>
          <div className="admin-kpi-card">
            <p>Hoàn thành</p>
            <h3>{kpi.completed}</h3>
          </div>
          <div className="admin-kpi-card">
            <p>Doanh thu hoàn thành</p>
            <h3>{formatMoney(kpi.revenueCompleted)}</h3>
          </div>
          <div className="admin-kpi-card">
            <p>Tổng giá trị đơn</p>
            <h3>{formatMoney(kpi.revenueAll)}</h3>
          </div>
        </div>

        <div className="admin-order-toolbar">
          <input
            type="text"
            placeholder="Tìm theo mã đơn, tên khách, số điện thoại, email..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="approved">Đã xác nhận</option>
            <option value="preparing">Đang chuẩn bị</option>
            <option value="delivering">Đang giao hàng</option>
            <option value="completed">Hoàn thành</option>
            <option value="canceled">Đã hủy</option>
          </select>

          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
            <option value="all">Tất cả thanh toán</option>
            <option value="cod">COD</option>
            <option value="bank">Chuyển khoản</option>
            <option value="momo">MoMo</option>
          </select>

          <select value={noteFilter} onChange={(e) => setNoteFilter(e.target.value)}>
            <option value="all">Tất cả ghi chú</option>
            <option value="hasNote">Có ghi chú</option>
            <option value="noNote">Không có ghi chú</option>
          </select>

          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="all">Tất cả thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="yesterday">Hôm qua</option>
            <option value="last7">7 ngày gần đây</option>
            <option value="last14">14 ngày gần đây</option>
            <option value="last30">30 ngày gần đây</option>
            <option value="thisMonth">Tháng này</option>
            <option value="lastMonth">Tháng trước</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Mới nhất trước</option>
            <option value="oldest">Cũ nhất trước</option>
            <option value="totalDesc">Tổng tiền cao nhất</option>
            <option value="totalAsc">Tổng tiền thấp nhất</option>
          </select>

          <button
            type="button"
            className="admin-reset-filter-btn"
            onClick={resetFilters}
          >
            Xóa bộ lọc
          </button>
        </div>

        {searchText && (
          <div className="admin-order-customer-filter-info">
            Đang lọc theo khách / từ khóa: <strong>{searchText}</strong>
          </div>
        )}

        <div className="admin-order-stats">
          <span>Chờ xác nhận: {kpi.pending}</span>
          <span>Đã xác nhận: {kpi.approved}</span>
          <span>Đang chuẩn bị: {kpi.preparing}</span>
          <span>Đang giao: {kpi.delivering}</span>
          <span>Hoàn thành: {kpi.completed}</span>
          <span>Đã hủy: {kpi.canceled}</span>
        </div>

        <div className="admin-bulk-bar">
          <label className="admin-select-all">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAllFiltered}
            />
            <span>Chọn tất cả đơn đang lọc</span>
          </label>

          <div className="admin-bulk-actions">
            <span>Đã chọn: {selectedIds.length}</span>

            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
              <option value="pending">Chờ xác nhận</option>
              <option value="approved">Đã xác nhận</option>
              <option value="preparing">Đang chuẩn bị</option>
              <option value="delivering">Đang giao hàng</option>
              <option value="completed">Hoàn thành</option>
              <option value="canceled">Đã hủy</option>
            </select>

            <button onClick={handleBulkUpdateStatus}>Cập nhật hàng loạt</button>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-box">
            <p>Đang tải đơn hàng...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="admin-empty-box">
            <p>Không có đơn hàng phù hợp bộ lọc.</p>
          </div>
        ) : (
          <div className="admin-order-list">
            {filteredOrders.map((order) => {
              const isOpen = openOrderId === order._id;
              const noteText = String(order.customerInfo?.note || '').trim();
              const paymentMethod = order.customerInfo?.paymentMethod || '';
              const customerPhone = order.customerInfo?.phone || order.customer?.phone || '';
              const customerAddress = order.customerInfo?.address || '';
              const customerName =
                order.customerInfo?.fullName || order.customer?.name || 'Chưa có';
              const customerEmail =
                order.customerInfo?.email || order.customer?.email || '';
              const isCanceled = isCanceledOrder(order);

              return (
                <div className="admin-order-card" key={order._id}>
                  <div
                    className="admin-order-summary"
                    onClick={() => toggleOrder(order._id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="admin-order-summary-left">
                      <label
                        className="admin-order-checkbox"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(order._id)}
                          onChange={() => toggleSelectOne(order._id)}
                          disabled={isCanceled}
                        />
                      </label>

                      <div>
                        <h3>Mã đơn: {order._id}</h3>
                        <p>Ngày đặt: {formatDate(order.cdate)}</p>
                        <p><strong>Khách hàng:</strong> {customerName}</p>
                        <p><strong>Số điện thoại:</strong> {customerPhone}</p>
                        <p><strong>Email:</strong> {customerEmail || 'Chưa có'}</p>
                      </div>
                    </div>

                    <div className="admin-order-summary-right">
                      <p><strong>Tổng tiền:</strong> {formatMoney(order.total)}</p>

                      <div className="admin-summary-badges">
                        <span className={getStatusClass(order.status)}>
                          {getStatusText(order.status)}
                        </span>

                        <span className={getPaymentBadgeClass(paymentMethod)}>
                          {paymentMethod
                            ? formatPaymentMethod(paymentMethod)
                            : 'Chưa có thanh toán'}
                        </span>

                        {noteText && (
                          <span className="admin-mini-badge note">Có ghi chú</span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="admin-toggle-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOrder(order._id);
                        }}
                      >
                        {isOpen ? 'Thu gọn' : 'Xem chi tiết'}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="admin-order-detail">
                      <hr />

                      {isCanceled && (
                        <div
                          style={{
                            marginBottom: '14px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: '#fff1f2',
                            color: '#be123c',
                            fontWeight: 600,
                            border: '1px solid #fecdd3'
                          }}
                        >
                          Đơn hàng này đã bị hủy. Admin không nên cập nhật trạng thái tiếp.
                        </div>
                      )}

                      <div className="admin-copy-actions">
                        <button onClick={() => copyText(order._id, 'mã đơn')}>
                          Copy mã đơn
                        </button>
                        <button onClick={() => copyText(customerPhone, 'số điện thoại')}>
                          Copy SĐT
                        </button>
                        <button onClick={() => copyText(customerAddress, 'địa chỉ')}>
                          Copy địa chỉ
                        </button>
                        <button onClick={() => copyText(customerEmail, 'email')}>
                          Copy email
                        </button>
                        <button onClick={() => openEmailModal(order)}>
                          Gửi email
                        </button>
                      </div>

                      <div className="admin-order-info-grid">
                        <p><strong>Địa chỉ:</strong> {customerAddress || 'Chưa có'}</p>
                        <p><strong>Phương thức thanh toán:</strong> {formatPaymentMethod(paymentMethod)}</p>
                        <p><strong>Trạng thái thanh toán:</strong> {order.paymentStatus || 'Chưa có'}</p>
                        <p><strong>Tổng tiền:</strong> {formatMoney(order.total)}</p>
                        <p><strong>Mã giảm giá:</strong> {order.voucherCode || 'Không có'}</p>
                        <p><strong>Lời nhắn:</strong> {noteText || 'Không có'}</p>
                        <p><strong>Email khách:</strong> {customerEmail || 'Chưa có'}</p>
                      </div>

                      <div className="admin-order-timeline-wrap">
                        <h4>Tiến trình đơn hàng</h4>
                        {renderTimeline(order.status)}
                      </div>

                      <div className="admin-order-products">
                        <h4>Sản phẩm trong đơn</h4>
                        {(order.items || []).map((item, index) => {
                          const product = item.product || {};
                          return (
                            <div
                              className="admin-order-product-row"
                              key={`${order._id}-${product._id || index}`}
                            >
                              <img
                                src={product.image}
                                alt={product.name}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <div>
                                <p><strong>{product.name}</strong></p>
                                <p>Số lượng: {item.quantity}</p>
                                <p>
                                  {formatMoney(
                                    Number(product.price || 0) * Number(item.quantity || 0)
                                  )}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="admin-order-actions">
                        <select
                          value={selectedStatuses[order._id] || order.status || 'pending'}
                          onChange={(e) => handleStatusChange(order._id, e.target.value)}
                          disabled={isCanceled}
                        >
                          <option value="pending">Chờ xác nhận</option>
                          <option value="approved">Đã xác nhận</option>
                          <option value="preparing">Đang chuẩn bị</option>
                          <option value="delivering">Đang giao hàng</option>
                          <option value="completed">Hoàn thành</option>
                          <option value="canceled">Đã hủy</option>
                        </select>

                        <button
                          onClick={() => handleSaveStatus(order._id)}
                          disabled={isCanceled}
                          style={{
                            opacity: isCanceled ? 0.6 : 1,
                            cursor: isCanceled ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Cập nhật trạng thái
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {emailModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={closeEmailModal}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '760px',
              background: '#fff',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.18)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '14px' }}>
              Soạn email cho khách hàng
            </h3>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Mã đơn
                </label>
                <input
                  type="text"
                  value={emailDraft.orderId}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    background: '#f9f9f9'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Người nhận
                </label>
                <input
                  type="text"
                  name="to"
                  value={emailDraft.to}
                  onChange={handleEmailDraftChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Tiêu đề
                </label>
                <input
                  type="text"
                  name="subject"
                  value={emailDraft.subject}
                  onChange={handleEmailDraftChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Nội dung
                </label>
                <textarea
                  name="body"
                  rows="14"
                  value={emailDraft.body}
                  onChange={handleEmailDraftChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                justifyContent: 'flex-end'
              }}
            >
              <button
                type="button"
                onClick={() => copyText(emailDraft.to, 'email')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  background: '#fff',
                  cursor: 'pointer'
                }}
              >
                Copy email
              </button>

              <button
                type="button"
                onClick={openGmailCompose}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#d81b60',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Mở Gmail
              </button>

              <button
                type="button"
                onClick={closeEmailModal}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  background: '#f5f5f5',
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </LayoutComponent>
  );
}

export default OrderAdminComponent;