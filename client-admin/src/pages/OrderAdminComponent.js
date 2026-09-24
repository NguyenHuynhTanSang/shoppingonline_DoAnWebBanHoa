import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API from '../services/api';
import LayoutComponent from '../components/LayoutComponent';

// Display policy only; every update is validated again by the backend.
const nextStatuses = {
  pending: ['approved', 'canceled'],
  approved: ['preparing', 'canceled'],
  preparing: ['delivering'],
  delivering: ['completed'],
  completed: [],
  canceled: []
};

const canSelectStatus = (from, to) =>
  from === to ||
  (nextStatuses[from] || []).includes(to);

const normalizeStatus = (status) =>
  String(status || '').toLowerCase();

const isCanceledOrder = (orderOrStatus) => {
  if (typeof orderOrStatus === 'string') {
    return normalizeStatus(orderOrStatus) === 'canceled';
  }

  return (
    normalizeStatus(orderOrStatus?.status) ===
    'canceled'
  );
};

const isDeliveryAssignableStatus = (status) =>
  ['approved', 'preparing'].includes(normalizeStatus(status));

const DELIVERY_FAILURE_OPTIONS = [
  {
    value: 'customer_unavailable',
    label: 'Không liên hệ được khách'
  },
  {
    value: 'customer_rescheduled',
    label: 'Khách hẹn giao lại'
  },
  {
    value: 'delivery_issue',
    label: 'Sự cố giao hàng'
  },
  {
    value: 'other',
    label: 'Lý do khác'
  }
];

const formatDeliveryDateTime = (value) => {
  if (!value) {
    return 'Chưa có';
  }

  const normalizedValue =
    typeof value === 'string' &&
    /^\d+$/.test(value)
      ? Number(value)
      : value;

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return 'Chưa có';
  }

  return date.toLocaleString('vi-VN');
};

const getDeliveryFailureLabel = (reason) => {
  const matched =
    DELIVERY_FAILURE_OPTIONS.find(
      (option) => option.value === reason
    );

  return matched?.label || reason || 'Không rõ';
};

const getStoredAdminRole = () => {
  const directRole = String(
    localStorage.getItem('adminRole') || ''
  )
    .trim()
    .toLowerCase();

  if (directRole) {
    return directRole;
  }

  for (const key of ['adminUser', 'admin']) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const role = String(parsed?.role || '')
        .trim()
        .toLowerCase();

      if (role) {
        return role;
      }
    } catch {
      // Ignore malformed legacy localStorage values.
    }
  }

  return '';
};

const getStoredAdminUser = () => {
  for (const key of ['adminUser', 'admin']) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Ignore malformed legacy localStorage values.
    }
  }

  return null;
};

function OrderAdminComponent() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [openOrderId, setOpenOrderId] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);

  const [staffs, setStaffs] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedDeliveryStaff, setSelectedDeliveryStaff] = useState({});
  const [deliveryAssignmentBusy, setDeliveryAssignmentBusy] = useState({});
  const [deliveryActionBusy, setDeliveryActionBusy] = useState({});
  const [deliveryFailureDrafts, setDeliveryFailureDrafts] = useState({});

  const currentRole = useMemo(() => getStoredAdminRole(), []);
const currentUser = useMemo(() => getStoredAdminUser(), []);

const currentStaffId =
  currentRole === 'staff'
    ? String(
        currentUser?._id ||
        currentUser?.id ||
        ''
      )
    : '';

const isAdmin = currentRole === 'admin';
const isStaff = currentRole === 'staff';

const isAssignedToCurrentStaff = (order) => {
  if (!isStaff || !currentStaffId) {
    return false;
  }

  const assignedStaffId =
    order?.delivery?.assignedStaff?.id;

  return (
    assignedStaffId &&
    String(assignedStaffId) === String(currentStaffId)
  );
};

const setDeliveryActionLoading = (orderId, value) => {
  setDeliveryActionBusy((previous) => ({
    ...previous,
    [orderId]: value
  }));
};

const updateDeliveryFailureDraft = (orderId, patch) => {
  setDeliveryFailureDrafts((previous) => ({
    ...previous,
    [orderId]: {
      open: false,
      reason: '',
      note: '',
      ...(previous[orderId] || {}),
      ...patch
    }
  }));
};

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
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await API.get('/admin/orders');

      if (res.data && res.data.success) {
        const data = res.data.orders || [];
        setOrders(data);

        const initStatuses = {};
        const initDeliveryStaff = {};

        data.forEach((order) => {
          initStatuses[order._id] = order.status || 'pending';
          initDeliveryStaff[order._id] = String(
            order.delivery?.assignedStaff?.id || ''
          );
        });

        setSelectedStatuses(initStatuses);
        setSelectedDeliveryStaff(initDeliveryStaff);
      } else {
        setOrders([]);
        setLoadError(res.data?.message || 'Không tải được danh sách đơn hàng.');
      }
    } catch (err) {
      console.error('Load orders error:', err);
      setOrders([]);
      setLoadError(err.response?.data?.message || 'Lỗi tải đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStaffs = useCallback(async () => {
    if (!isAdmin) {
      setStaffs([]);
      return;
    }

    try {
      setStaffLoading(true);
      const res = await API.get('/admin/staffs');

      if (res.data?.success) {
        const activeStaffs = (res.data.staffs || []).filter(
          (staff) => Number(staff.active) === 1
        );

        setStaffs(activeStaffs);
      } else {
        setStaffs([]);
        alert(res.data?.message || 'Không tải được danh sách nhân viên.');
      }
    } catch (err) {
      console.error('Load staffs error:', err);
      setStaffs([]);
      alert(
        err.response?.data?.message ||
          'Không tải được danh sách nhân viên giao hàng.'
      );
    } finally {
      setStaffLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadStaffs();
  }, [loadStaffs]);

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

      if (!canSelectStatus(currentStatus, newStatus)) {
        alert('Không thể chuyển trạng thái đơn hàng theo yêu cầu.');
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

  const replaceOrderFromResponse = (savedOrder) => {
    if (!savedOrder?._id) {
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order._id === savedOrder._id
          ? savedOrder
          : order
      )
    );

    setSelectedStatuses((prev) => ({
      ...prev,
      [savedOrder._id]:
        savedOrder.status || 'pending'
    }));

    setSelectedDeliveryStaff((prev) => ({
      ...prev,
      [savedOrder._id]: String(
        savedOrder.delivery?.assignedStaff?.id || ''
      )
    }));
  };

  const handleDeliveryStaffChange = (orderId, staffId) => {
    setSelectedDeliveryStaff((prev) => ({
      ...prev,
      [orderId]: staffId
    }));
  };

  const handleAssignDeliveryStaff = async (order) => {
    if (!isAdmin) {
      alert('Chỉ admin mới được phân công nhân viên giao hàng.');
      return;
    }

    if (!isDeliveryAssignableStatus(order.status)) {
      alert(
        'Chỉ có thể phân công khi đơn đã xác nhận hoặc đang chuẩn bị.'
      );
      return;
    }

    const orderId = order._id;
    const staffId = String(
      selectedDeliveryStaff[orderId] || ''
    ).trim();

    if (!staffId) {
      alert('Vui lòng chọn nhân viên giao hàng.');
      return;
    }

    const currentStaffId = String(
      order.delivery?.assignedStaff?.id || ''
    );

    if (currentStaffId === staffId) {
      alert('Nhân viên này đã được phân công cho đơn hàng.');
      return;
    }

    if (currentStaffId) {
      const ok = window.confirm(
        `Đơn hiện đang được giao cho ${
          order.delivery?.assignedStaff?.name || 'nhân viên khác'
        }. Bạn có chắc muốn đổi nhân viên không?`
      );

      if (!ok) return;
    }

    try {
      setDeliveryAssignmentBusy((prev) => ({
        ...prev,
        [orderId]: true
      }));

      const res = await API.put(
        `/admin/orders/${orderId}/delivery/assignment`,
        { staffId }
      );

      if (!res.data?.success) {
        alert(res.data?.message || 'Phân công nhân viên thất bại.');
        return;
      }

      replaceOrderFromResponse(res.data.order);
      alert(
        currentStaffId
          ? 'Đổi nhân viên giao hàng thành công!'
          : 'Phân công nhân viên giao hàng thành công!'
      );
    } catch (err) {
      console.error('Assign delivery staff error:', err);
      alert(
        err.response?.data?.message ||
          'Không thể phân công nhân viên giao hàng.'
      );
    } finally {
      setDeliveryAssignmentBusy((prev) => ({
        ...prev,
        [orderId]: false
      }));
    }
  };

  const handleClearDeliveryAssignment = async (order) => {
    if (!isAdmin) {
      alert('Chỉ admin mới được bỏ phân công giao hàng.');
      return;
    }

    if (!isDeliveryAssignableStatus(order.status)) {
      alert(
        'Không thể thay đổi phân công khi đơn đã bắt đầu giao hoặc đã kết thúc.'
      );
      return;
    }

    const assignedName =
      order.delivery?.assignedStaff?.name || 'nhân viên hiện tại';

    const ok = window.confirm(
      `Bạn có chắc muốn bỏ phân công ${assignedName} khỏi đơn hàng này không?`
    );

    if (!ok) return;

    try {
      setDeliveryAssignmentBusy((prev) => ({
        ...prev,
        [order._id]: true
      }));

      const res = await API.delete(
        `/admin/orders/${order._id}/delivery/assignment`
      );

      if (!res.data?.success) {
        alert(res.data?.message || 'Bỏ phân công thất bại.');
        return;
      }

      replaceOrderFromResponse(res.data.order);
      alert('Đã bỏ phân công nhân viên giao hàng.');
    } catch (err) {
      console.error('Clear delivery assignment error:', err);
      alert(
        err.response?.data?.message ||
          'Không thể bỏ phân công nhân viên giao hàng.'
      );
    } finally {
      setDeliveryAssignmentBusy((prev) => ({
        ...prev,
        [order._id]: false
      }));
    }
  };
  const handleStartDelivery = async (order) => {
  if (
    !order?._id ||
    !isAssignedToCurrentStaff(order)
  ) {
    return;
  }

  const confirmed = window.confirm(
    'Bắt đầu giao đơn hàng này?'
  );

  if (!confirmed) {
    return;
  }

  try {
    setDeliveryActionLoading(
      order._id,
      'start'
    );

    const res = await API.post(
      `/admin/orders/${order._id}/delivery/start`
    );

    if (res.data?.order) {
      replaceOrderFromResponse(
        res.data.order
      );
    }

    alert(
      res.data?.message ||
      'Đã bắt đầu giao hàng.'
    );
  } catch (error) {
    console.error(
      'START DELIVERY ERROR:',
      error
    );

    alert(
      error.response?.data?.message ||
      'Không thể bắt đầu giao hàng.'
    );
  } finally {
    setDeliveryActionLoading(
      order._id,
      ''
    );
  }
};

const handleFailDelivery = async (order) => {
  if (
    !order?._id ||
    !isAssignedToCurrentStaff(order)
  ) {
    return;
  }

  const draft =
    deliveryFailureDrafts[order._id] || {};

  const reason = String(
    draft.reason || ''
  ).trim();

  const note = String(
    draft.note || ''
  ).trim();

  if (!reason) {
    alert(
      'Vui lòng chọn lý do giao hàng chưa thành công.'
    );
    return;
  }

  if (note.length > 300) {
    alert(
      'Ghi chú giao hàng không được quá 300 ký tự.'
    );
    return;
  }

  const confirmed = window.confirm(
    'Xác nhận ghi nhận lần giao hàng chưa thành công?'
  );

  if (!confirmed) {
    return;
  }

  try {
    setDeliveryActionLoading(
      order._id,
      'fail'
    );

    const res = await API.post(
      `/admin/orders/${order._id}/delivery/fail`,
      {
        reason,
        note
      }
    );

    if (res.data?.order) {
      replaceOrderFromResponse(
        res.data.order
      );
    }

    setDeliveryFailureDrafts(
      (previous) => ({
        ...previous,
        [order._id]: {
          open: false,
          reason: '',
          note: ''
        }
      })
    );

    alert(
      res.data?.message ||
      'Đã ghi nhận giao hàng chưa thành công.'
    );
  } catch (error) {
    console.error(
      'FAIL DELIVERY ERROR:',
      error
    );

    alert(
      error.response?.data?.message ||
      'Không thể ghi nhận giao hàng chưa thành công.'
    );
  } finally {
    setDeliveryActionLoading(
      order._id,
      ''
    );
  }
};

const handleCompleteDelivery = async (order) => {
  if (
    !order?._id ||
    !isAssignedToCurrentStaff(order)
  ) {
    return;
  }

  const confirmed = window.confirm(
    'Xác nhận đơn hàng đã được giao thành công?'
  );

  if (!confirmed) {
    return;
  }

  try {
    setDeliveryActionLoading(
      order._id,
      'complete'
    );

    const res = await API.post(
      `/admin/orders/${order._id}/delivery/complete`
    );

    if (res.data?.order) {
      replaceOrderFromResponse(
        res.data.order
      );
    }

    alert(
      res.data?.message ||
      'Giao hàng thành công.'
    );
  } catch (error) {
    console.error(
      'COMPLETE DELIVERY ERROR:',
      error
    );

    alert(
      error.response?.data?.message ||
      'Không thể hoàn thành giao hàng.'
    );
  } finally {
    setDeliveryActionLoading(
      order._id,
      ''
    );
  }
};

  const handleBulkUpdateStatus = async () => {
    try {
      if (selectedIds.length === 0) {
        alert('Vui lòng chọn ít nhất 1 đơn hàng.');
        return;
      }

      const selectedOrders = orders.filter((order) => selectedIds.includes(order._id));
      const canceledOrders = selectedOrders.filter((order) => !canSelectStatus(normalizeStatus(order.status), bulkStatus));

      if (canceledOrders.length > 0) {
        alert('Có đơn không thể chuyển sang trạng thái đã chọn. Vui lòng kiểm tra lại.');
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
              <option value="pending" disabled={!selectedIds.length || orders.filter(order => selectedIds.includes(order._id)).some(order => !canSelectStatus(normalizeStatus(order.status), "pending"))}>Chờ xác nhận</option>
              <option value="approved" disabled={!selectedIds.length || orders.filter(order => selectedIds.includes(order._id)).some(order => !canSelectStatus(normalizeStatus(order.status), "approved"))}>Đã xác nhận</option>
              <option value="preparing" disabled={!selectedIds.length || orders.filter(order => selectedIds.includes(order._id)).some(order => !canSelectStatus(normalizeStatus(order.status), "preparing"))}>Đang chuẩn bị</option>
              <option value="delivering" disabled={!selectedIds.length || orders.filter(order => selectedIds.includes(order._id)).some(order => !canSelectStatus(normalizeStatus(order.status), "delivering"))}>Đang giao hàng</option>
              <option value="completed" disabled={!selectedIds.length || orders.filter(order => selectedIds.includes(order._id)).some(order => !canSelectStatus(normalizeStatus(order.status), "completed"))}>Hoàn thành</option>
              <option value="canceled" disabled={!selectedIds.length || orders.filter(order => selectedIds.includes(order._id)).some(order => !canSelectStatus(normalizeStatus(order.status), "canceled"))}>Đã hủy</option>
            </select>

            <button onClick={handleBulkUpdateStatus}>Cập nhật hàng loạt</button>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-box">
            <p>Đang tải đơn hàng...</p>
          </div>
        ) : loadError ? (
          <div className="admin-empty-box" role="alert">
            <h2>Không thể tải đơn hàng</h2>
            <p>{loadError}</p>
            <button type="button" className="admin-reset-filter-btn" onClick={loadOrders}>
              Thử lại
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="admin-empty-box">
            <p>{orders.length === 0 ? 'Chưa có đơn hàng.' : 'Không có đơn hàng phù hợp bộ lọc.'}</p>
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

              const assignedStaff = order.delivery?.assignedStaff || null;
              const assignedStaffId = String(assignedStaff?.id || '');
              const selectedStaffId = String(
                selectedDeliveryStaff[order._id] || ''
              );
              const canEditDeliveryAssignment =
                isAdmin && isDeliveryAssignableStatus(order.status);
              const isAssignmentBusy = Boolean(
                deliveryAssignmentBusy[order._id]
              );
              const orderStatus =
  normalizeStatus(order.status);

const assignedToCurrentStaff =
  isAssignedToCurrentStaff(order);

const deliveryBusyAction =
  deliveryActionBusy[order._id] || '';

const isDeliveryActionBusy =
  Boolean(deliveryBusyAction);

const failureDraft =
  deliveryFailureDrafts[order._id] || {
    open: false,
    reason: '',
    note: ''
  };
  const deliveryAttempts =
  Array.isArray(order.delivery?.attempts)
    ? order.delivery.attempts
    : [];

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

                        {assignedStaff?.name && (
                          <span className="admin-mini-badge">
                            Giao: {assignedStaff.name}
                          </span>
                        )}

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
                        <p><strong>Ngày giao hoa:</strong> {order.deliveryDate || '—'}</p>
                        <p><strong>Khung giờ giao mong muốn:</strong> {order.deliveryTimeSlot || '—'}</p>
                        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><strong>Lời nhắn thiệp:</strong> {order.cardMessage || '—'}</p>
                        <p><strong>Địa chỉ:</strong> {customerAddress || 'Chưa có'}</p>
                        <p><strong>Phương thức thanh toán:</strong> {formatPaymentMethod(paymentMethod)}</p>
                        <p><strong>Trạng thái thanh toán:</strong> {order.paymentStatus === 'Đã thanh toán demo' ? 'Thanh toán demo - chưa xác minh (dữ liệu cũ)' : order.paymentStatus || 'Chưa có'}</p>
                        <p><strong>Tổng tiền:</strong> {formatMoney(order.total)}</p>
                        <p><strong>Mã giảm giá:</strong> {order.voucherCode || 'Không có'}</p>
                        <p><strong>Ghi chú cho shop:</strong> {noteText || 'Không có'}</p>
                        <p><strong>Email khách:</strong> {customerEmail || 'Chưa có'}</p>
                      </div>

                      <div
                        style={{
                          marginTop: '18px',
                          padding: '16px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          background: '#fafafa'
                        }}
                      >
                        <h4 style={{ marginTop: 0, marginBottom: '12px' }}>
                          Phân công giao hàng
                        </h4>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '8px',
                            marginBottom: '12px'
                          }}
                        >
                          <p style={{ margin: 0 }}>
                            <strong>Nhân viên:</strong>{' '}
                            {assignedStaff?.name || 'Chưa phân công'}
                          </p>

                          <p style={{ margin: 0 }}>
                            <strong>Phân công lúc:</strong>{' '}
                            {order.delivery?.assignedAt
                              ? formatDate(order.delivery.assignedAt)
                              : 'Chưa có'}
                          </p>
                        </div>

                        {isAdmin ? (
                          canEditDeliveryAssignment ? (
                            <div
                              style={{
                                display: 'flex',
                                gap: '10px',
                                flexWrap: 'wrap',
                                alignItems: 'center'
                              }}
                            >
                              <select
                                value={selectedStaffId}
                                onChange={(e) =>
                                  handleDeliveryStaffChange(
                                    order._id,
                                    e.target.value
                                  )
                                }
                                disabled={staffLoading || isAssignmentBusy}
                                style={{
                                  minWidth: '240px',
                                  padding: '10px 12px'
                                }}
                              >
                                <option value="">
                                  {staffLoading
                                    ? 'Đang tải nhân viên...'
                                    : '-- Chọn nhân viên giao hàng --'}
                                </option>

                                {staffs.map((staff) => (
                                  <option key={staff._id} value={staff._id}>
                                    {staff.name || staff.username}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() =>
                                  handleAssignDeliveryStaff(order)
                                }
                                disabled={
                                  isAssignmentBusy ||
                                  !selectedStaffId ||
                                  selectedStaffId === assignedStaffId
                                }
                                style={{
                                  opacity:
                                    isAssignmentBusy ||
                                    !selectedStaffId ||
                                    selectedStaffId === assignedStaffId
                                      ? 0.6
                                      : 1,
                                  cursor:
                                    isAssignmentBusy ||
                                    !selectedStaffId ||
                                    selectedStaffId === assignedStaffId
                                      ? 'not-allowed'
                                      : 'pointer'
                                }}
                              >
                                {isAssignmentBusy
                                  ? 'Đang xử lý...'
                                  : assignedStaffId
                                    ? 'Đổi nhân viên'
                                    : 'Phân công'}
                              </button>

                              {assignedStaffId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleClearDeliveryAssignment(order)
                                  }
                                  disabled={isAssignmentBusy}
                                  style={{
                                    background: '#fff',
                                    color: '#be123c',
                                    border: '1px solid #fecdd3',
                                    opacity: isAssignmentBusy ? 0.6 : 1,
                                    cursor: isAssignmentBusy
                                      ? 'not-allowed'
                                      : 'pointer'
                                  }}
                                >
                                  Bỏ phân công
                                </button>
                              )}
                            </div>
                          ) : (
                            <p style={{ margin: 0, color: '#6b7280' }}>
                              Chỉ có thể thay đổi nhân viên khi đơn ở trạng thái
                              “Đã xác nhận” hoặc “Đang chuẩn bị”.
                            </p>
                          )
                        ) : (
                          <p style={{ margin: 0, color: '#6b7280' }}>
                            Chỉ admin được phân công hoặc thay đổi nhân viên giao
                            hàng.
                          </p>
                        )}
                      </div>
                      {order.delivery && (
  <div
    style={{
      marginTop: '18px',
      padding: '16px',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      background: '#ffffff'
    }}
  >
    <h4
      style={{
        marginTop: 0,
        marginBottom: '14px'
      }}
    >
      Chi tiết giao hàng
    </h4>

    <div
      style={{
        display: 'grid',
        gap: '8px'
      }}
    >
      <div>
        <strong>Nhân viên giao:</strong>{' '}
        {assignedStaff?.name ||
          'Chưa phân công'}
      </div>

      <div>
        <strong>Thời điểm phân công:</strong>{' '}
        {formatDeliveryDateTime(
          order.delivery?.assignedAt
        )}
      </div>

      <div>
        <strong>Bắt đầu giao:</strong>{' '}
        {formatDeliveryDateTime(
          order.delivery?.startedAt
        )}
      </div>

      <div>
        <strong>Giao thành công:</strong>{' '}
        {formatDeliveryDateTime(
          order.delivery?.deliveredAt
        )}
      </div>
    </div>

    <div
      style={{
        marginTop: '16px'
      }}
    >
      <strong>
        Lịch sử giao chưa thành công
      </strong>

      {deliveryAttempts.length === 0 ? (
        <p
          style={{
            marginBottom: 0,
            color: '#6b7280'
          }}
        >
          Chưa có lần giao hàng thất bại.
        </p>
      ) : (
        <div
          style={{
            marginTop: '10px',
            display: 'grid',
            gap: '10px'
          }}
        >
          {deliveryAttempts.map(
            (attempt, index) => (
              <div
                key={`${order._id}-delivery-attempt-${index}`}
                style={{
                  padding: '12px',
                  border: '1px solid #fde68a',
                  borderRadius: '10px',
                  background: '#fffbeb'
                }}
              >
                <div>
                  <strong>
                    Lần {index + 1}
                  </strong>
                </div>

                <div>
                  <strong>Lý do:</strong>{' '}
                  {getDeliveryFailureLabel(
                    attempt?.reason
                  )}
                </div>

                <div>
                  <strong>Ghi chú:</strong>{' '}
                  {attempt?.note ||
                    'Không có ghi chú'}
                </div>

                <div>
                  <strong>Thời điểm:</strong>{' '}
                  {formatDeliveryDateTime(
                    attempt?.attemptedAt
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  </div>
)}

                      <div className="admin-order-timeline-wrap">
                        {isStaff && (
  <div
    style={{
      marginTop: '18px',
      padding: '16px',
      border: '1px solid #dbeafe',
      borderRadius: '12px',
      background: '#f8fbff'
    }}
  >
    <h4
      style={{
        marginTop: 0,
        marginBottom: '12px'
      }}
    >
      Thao tác giao hàng
    </h4>

    {!assignedStaffId ? (
      <p
        style={{
          margin: 0,
          color: '#6b7280'
        }}
      >
        Đơn hàng chưa được admin phân công nhân viên giao hàng.
      </p>
    ) : !assignedToCurrentStaff ? (
      <p
        style={{
          margin: 0,
          color: '#6b7280'
        }}
      >
        Đơn hàng này được phân công cho nhân viên khác.
      </p>
    ) : orderStatus === 'approved' ? (
      <p
        style={{
          margin: 0,
          color: '#6b7280'
        }}
      >
        Hãy chuyển đơn sang trạng thái “Đang chuẩn bị” trước khi bắt đầu giao.
      </p>
    ) : orderStatus === 'preparing' ? (
      <button
        type="button"
        onClick={() =>
          handleStartDelivery(order)
        }
        disabled={isDeliveryActionBusy}
      >
        {deliveryBusyAction === 'start'
          ? 'Đang bắt đầu giao...'
          : 'Bắt đầu giao hàng'}
      </button>
    ) : orderStatus === 'delivering' ? (
      <div>
        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={() =>
              updateDeliveryFailureDraft(
                order._id,
                {
                  open: !failureDraft.open
                }
              )
            }
            disabled={isDeliveryActionBusy}
          >
            Giao chưa thành công
          </button>

          <button
            type="button"
            onClick={() =>
              handleCompleteDelivery(order)
            }
            disabled={isDeliveryActionBusy}
          >
            {deliveryBusyAction === 'complete'
              ? 'Đang hoàn thành...'
              : 'Hoàn thành giao hàng'}
          </button>
        </div>

        {failureDraft.open && (
          <div
            style={{
              marginTop: '14px',
              padding: '14px',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              background: '#fffbeb'
            }}
          >
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: 600
              }}
            >
              Lý do giao chưa thành công
            </label>

            <select
              value={failureDraft.reason || ''}
              onChange={(e) =>
                updateDeliveryFailureDraft(
                  order._id,
                  {
                    reason: e.target.value
                  }
                )
              }
              disabled={isDeliveryActionBusy}
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: '12px'
              }}
            >
              <option value="">
                -- Chọn lý do --
              </option>

              {DELIVERY_FAILURE_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>

            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: 600
              }}
            >
              Ghi chú
            </label>

            <textarea
              rows="3"
              maxLength={300}
              placeholder="Ví dụ: Khách chưa nghe máy..."
              value={failureDraft.note || ''}
              onChange={(e) =>
                updateDeliveryFailureDraft(
                  order._id,
                  {
                    note: e.target.value
                  }
                )
              }
              disabled={isDeliveryActionBusy}
              style={{
                width: '100%',
                padding: '10px 12px',
                resize: 'vertical'
              }}
            />

            <div
              style={{
                marginTop: '4px',
                marginBottom: '12px',
                textAlign: 'right',
                color: '#6b7280',
                fontSize: '13px'
              }}
            >
              {(failureDraft.note || '').length}/300
            </div>

            <div
              style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <button
                type="button"
                onClick={() =>
                  handleFailDelivery(order)
                }
                disabled={
                  isDeliveryActionBusy ||
                  !failureDraft.reason
                }
              >
                {deliveryBusyAction === 'fail'
                  ? 'Đang ghi nhận...'
                  : 'Xác nhận giao chưa thành công'}
              </button>

              <button
                type="button"
                onClick={() =>
                  updateDeliveryFailureDraft(
                    order._id,
                    {
                      open: false
                    }
                  )
                }
                disabled={isDeliveryActionBusy}
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    ) : orderStatus === 'completed' ? (
      <p
        style={{
          margin: 0,
          color: '#15803d',
          fontWeight: 600
        }}
      >
        Đơn hàng đã được giao thành công.
      </p>
    ) : (
      <p
        style={{
          margin: 0,
          color: '#6b7280'
        }}
      >
        Hiện chưa có thao tác giao hàng cho trạng thái này.
      </p>
    )}
  </div>
)}
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

                      {isStaff &&
  ['preparing', 'delivering'].includes(orderStatus) && (
    <div className="admin-order-actions">
      <p
        style={{
          margin: 0,
          color: '#6b7280'
        }}
      >
        Nhân viên sử dụng mục “Thao tác giao hàng” phía trên để xử lý đơn này.
      </p>
    </div>
  )}

<div
  className="admin-order-actions"
  style={{
    display:
      isStaff &&
      ['preparing', 'delivering'].includes(orderStatus)
        ? 'none'
        : undefined
  }}
>
                        <select
                          value={selectedStatuses[order._id] || order.status || 'pending'}
                          onChange={(e) => handleStatusChange(order._id, e.target.value)}
                          disabled={!(nextStatuses[normalizeStatus(order.status)] || []).length}
                        >
                          <option value="pending" disabled={!canSelectStatus(normalizeStatus(order.status), "pending")}>Chờ xác nhận</option>
                          <option value="approved" disabled={!canSelectStatus(normalizeStatus(order.status), "approved")}>Đã xác nhận</option>
                          <option value="preparing" disabled={!canSelectStatus(normalizeStatus(order.status), "preparing")}>Đang chuẩn bị</option>
                          <option value="delivering" disabled={!canSelectStatus(normalizeStatus(order.status), "delivering")}>Đang giao hàng</option>
                          <option value="completed" disabled={!canSelectStatus(normalizeStatus(order.status), "completed")}>Hoàn thành</option>
                          <option value="canceled" disabled={!canSelectStatus(normalizeStatus(order.status), "canceled")}>Đã hủy</option>
                        </select>

                        <button
                          onClick={() => handleSaveStatus(order._id)}
                          disabled={!(nextStatuses[normalizeStatus(order.status)] || []).length}
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
