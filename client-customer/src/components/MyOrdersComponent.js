import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function getReviewKey(orderId, productId) {
  return `${String(orderId || '')}__${String(productId || '')}`;
}

function getDefaultReviewDraft() {
  return {
    open: false,
    rating: '5',
    comment: '',
    submitting: false,
    submitted: false,
    successMessage: '',
    errorMessage: ''
  };
}

function MyOrdersComponent() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [reviewDrafts, setReviewDrafts] = useState({});
  const navigate = useNavigate();

  const clearCustomerSession = useCallback(() => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customer');
    localStorage.removeItem('cart');
    localStorage.removeItem('cartDiscount');
    localStorage.removeItem('cartVoucherCode');
    localStorage.removeItem('cartVoucherInfo');
  }, []);

  const forceLogout = useCallback(
    (message) => {
      clearCustomerSession();
      alert(message);
      navigate('/login', { replace: true });
    },
    [clearCustomerSession, navigate]
  );

  const handleCustomerApiError = useCallback(
    (error, fallbackMessage) => {
      const status = error.response?.status;
      const code = error.response?.data?.code;
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        fallbackMessage ||
        'Có lỗi xảy ra.';

      if (status === 403 && code === 'ACCOUNT_LOCKED') {
        forceLogout('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
        return true;
      }

      if (status === 403 && code === 'ACCOUNT_INACTIVE') {
        forceLogout('Tài khoản của bạn chưa được kích hoạt.');
        return true;
      }

      if (
        status === 401 ||
        code === 'INVALID_TOKEN' ||
        message === 'Token is not valid' ||
        message === 'Token has expired' ||
        message === 'Auth token is not supplied'
      ) {
        forceLogout('Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
        return true;
      }

      return false;
    },
    [forceLogout]
  );

  const fetchOrders = useCallback(async () => {
    const token = localStorage.getItem('customerToken');

    if (!token) {
      alert('Vui lòng đăng nhập để xem đơn hàng.');
      navigate('/login');
      return;
    }

    try {
      setLoading(true);

      const res = await API.get('/customer/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.data?.success === false) {
        console.error('API orders lỗi:', res.data);
        setOrders([]);
        return;
      }

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.orders)
          ? res.data.orders
          : [];

      const sortedOrders = [...data].sort(
        (a, b) => Number(b?.cdate || 0) - Number(a?.cdate || 0)
      );

      setOrders(sortedOrders);

      const initialExpanded = {};
      sortedOrders.forEach((order, index) => {
        if (index === 0) initialExpanded[order._id] = true;
      });
      setExpandedOrders(initialExpanded);
    } catch (error) {
      console.error('Lỗi khi lấy đơn hàng:', error);
      console.error('STATUS:', error.response?.status);
      console.error('DATA:', error.response?.data);

      const handled = handleCustomerApiError(
        error,
        'Không thể tải đơn hàng. Vui lòng thử lại sau.'
      );
      if (handled) return;

      alert(
        error.response?.data?.message ||
          'Không thể tải đơn hàng. Vui lòng thử lại sau.'
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [navigate, handleCustomerApiError]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusText = (status) => {
    const s = String(status || '').toLowerCase();
    switch (s) {
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
        return status || 'Chờ xử lý';
    }
  };

  const getStatusClass = (status) => {
    const s = String(status || '').toLowerCase();
    switch (s) {
      case 'pending':
        return 'order-status pending';
      case 'approved':
        return 'order-status approved';
      case 'preparing':
        return 'order-status preparing';
      case 'delivering':
        return 'order-status delivering';
      case 'completed':
        return 'order-status completed';
      case 'canceled':
        return 'order-status canceled';
      default:
        return 'order-status';
    }
  };

  const getPaymentMethodText = (paymentMethod) => {
    if (paymentMethod === 'cod') return 'Thanh toán khi nhận hàng';
    if (paymentMethod === 'bank') return 'Chuyển khoản ngân hàng';
    if (paymentMethod === 'momo') return 'Ví điện tử MoMo';
    return 'Chưa có';
  };

  const renderImageSrc = (img) => {
    if (!img) return '';
    if (img.startsWith('data:image')) return img;
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    return img;
  };

  const canCancelOrder = (status) => {
    return String(status || '').toLowerCase() === 'pending';
  };

  const toggleOrderDetails = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const toggleReviewForm = (orderId, productId) => {
    const key = getReviewKey(orderId, productId);

    setReviewDrafts((prev) => {
      const current = prev[key] || getDefaultReviewDraft();

      return {
        ...prev,
        [key]: {
          ...current,
          open: !current.open,
          errorMessage: '',
          successMessage: current.submitted ? current.successMessage : ''
        }
      };
    });
  };

  const handleReviewFieldChange = (orderId, productId, field, value) => {
    const key = getReviewKey(orderId, productId);

    setReviewDrafts((prev) => {
      const current = prev[key] || getDefaultReviewDraft();

      return {
        ...prev,
        [key]: {
          ...current,
          [field]: value,
          errorMessage: '',
          successMessage: ''
        }
      };
    });
  };

  const handleSubmitReview = async (orderId, productId) => {
    const token = localStorage.getItem('customerToken');

    if (!token) {
      alert('Vui lòng đăng nhập lại.');
      navigate('/login');
      return;
    }

    const key = getReviewKey(orderId, productId);
    const current = reviewDrafts[key] || getDefaultReviewDraft();
    const rating = Number(current.rating || 5);
    const comment = String(current.comment || '').trim();

    if (!comment) {
      setReviewDrafts((prev) => ({
        ...prev,
        [key]: {
          ...current,
          open: true,
          errorMessage: 'Vui lòng nhập nội dung đánh giá.'
        }
      }));
      return;
    }

    try {
      setReviewDrafts((prev) => ({
        ...prev,
        [key]: {
          ...current,
          open: true,
          submitting: true,
          errorMessage: '',
          successMessage: ''
        }
      }));

      const res = await API.post(
        '/customer/reviews',
        {
          orderId,
          productId,
          rating,
          comment
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (res.data?.success === false) {
        setReviewDrafts((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] || getDefaultReviewDraft()),
            open: true,
            submitting: false,
            errorMessage: res.data?.message || 'Không thể gửi đánh giá.'
          }
        }));
        return;
      }

      setReviewDrafts((prev) => ({
        ...prev,
        [key]: {
          open: false,
          rating: '5',
          comment: '',
          submitting: false,
          submitted: true,
          successMessage: res.data?.message || 'Đánh giá sản phẩm thành công.',
          errorMessage: ''
        }
      }));

      setOrders((prev) =>
        prev.map((order) => {
          if (String(order._id) !== String(orderId)) return order;

          return {
            ...order,
            items: (Array.isArray(order.items) ? order.items : []).map((item) => {
              if (String(item?.product?._id || '') !== String(productId)) return item;
              return {
                ...item,
                hasReviewed: true
              };
            })
          };
        })
      );
    } catch (error) {
      console.error('REVIEW ERROR:', error);

      const handled = handleCustomerApiError(
        error,
        'Không thể gửi đánh giá. Vui lòng thử lại sau.'
      );
      if (handled) return;

      setReviewDrafts((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || getDefaultReviewDraft()),
          open: true,
          submitting: false,
          errorMessage:
            error.response?.data?.message ||
            'Không thể gửi đánh giá. Vui lòng thử lại sau.'
        }
      }));
    }
  };

  const handleCancelOrder = async (orderId) => {
    const token = localStorage.getItem('customerToken');

    if (!token) {
      alert('Vui lòng đăng nhập lại.');
      navigate('/login');
      return;
    }

    const confirmed = window.confirm(
      'Bạn có chắc muốn hủy đơn này không? Chỉ đơn đang chờ xác nhận mới được hủy.'
    );

    if (!confirmed) return;

    try {
      setCancelingId(orderId);

      const res = await API.put(
        `/customer/orders/${orderId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (res.data?.success === false) {
        alert(res.data?.message || 'Không thể hủy đơn hàng.');
        return;
      }

      alert(res.data?.message || 'Hủy đơn hàng thành công.');

      setOrders((prev) =>
        prev.map((order) =>
          order._id === orderId
            ? {
                ...order,
                status: 'canceled'
              }
            : order
        )
      );
    } catch (error) {
      console.error('CANCEL ORDER ERROR:', error);

      const handled = handleCustomerApiError(
        error,
        'Không thể hủy đơn hàng. Vui lòng thử lại sau.'
      );
      if (handled) return;

      alert(
        error.response?.data?.message ||
          'Không thể hủy đơn hàng. Vui lòng thử lại sau.'
      );
    } finally {
      setCancelingId('');
    }
  };

  const filteredOrders = useMemo(() => {
    const keyword = String(searchKeyword || '').trim().toLowerCase();

    return orders.filter((order) => {
      const status = String(order?.status || '').toLowerCase();
      const orderId = String(order?._id || '').toLowerCase();

      const matchStatus =
        statusFilter === 'all' ? true : status === statusFilter;

      const matchKeyword = keyword ? orderId.includes(keyword) : true;

      return matchStatus && matchKeyword;
    });
  }, [orders, searchKeyword, statusFilter]);

  return (
    <div>
      <MenuComponent />

      <div className="container my-orders-page">
        <div className="cart-top">
          <h1>Đơn hàng của tôi</h1>
          <Link to="/" className="back-home-btn">
            ← Quay về trang chủ
          </Link>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: '14px',
            padding: '16px',
            marginBottom: '18px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}
          >
            <input
              type="text"
              placeholder="Tìm theo mã đơn..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                flex: '1 1 260px',
                minWidth: '240px',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1px solid #ddd',
                outline: 'none'
              }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                minWidth: '210px',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1px solid #ddd',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ xác nhận</option>
              <option value="approved">Đã xác nhận</option>
              <option value="preparing">Đang chuẩn bị</option>
              <option value="delivering">Đang giao hàng</option>
              <option value="completed">Hoàn thành</option>
              <option value="canceled">Đã hủy</option>
            </select>
          </div>

          <p style={{ margin: '12px 0 0', color: '#666' }}>
            Hiển thị {filteredOrders.length} / {orders.length} đơn hàng
          </p>
        </div>

        {loading ? (
          <div className="empty-orders-box">
            <p>Đang tải đơn hàng...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-orders-box">
            <p>Không tìm thấy đơn hàng phù hợp.</p>
            <Link to="/" className="back-home-btn">
              Tiếp tục mua sắm
            </Link>
          </div>
        ) : (
          <div className="orders-list">
            {filteredOrders.map((order) => {
              const isExpanded = !!expandedOrders[order._id];
              const isPending = canCancelOrder(order.status);

              return (
                <div className="order-card" key={order._id}>
                  <div className="order-card-top">
                    <div>
                      <h3 style={{ marginBottom: '6px' }}>Mã đơn: {order._id}</h3>
                      <p style={{ margin: 0 }}>
                        Ngày đặt:{' '}
                        {order.cdate
                          ? new Date(order.cdate).toLocaleString('vi-VN')
                          : 'Chưa có'}
                      </p>
                      <p style={{ margin: '6px 0 0' }}>
                        Tổng tiền: <strong>{formatMoney(order.total)} đ</strong>
                      </p>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '10px'
                      }}
                    >
                      <span className={getStatusClass(order.status)}>
                        {getStatusText(order.status)}
                      </span>

                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleOrderDetails(order._id)}
                          style={{
                            background: '#111827',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          {isExpanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                        </button>

                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleCancelOrder(order._id)}
                            disabled={cancelingId === order._id}
                            style={{
                              background: '#e11d48',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              cursor: cancelingId === order._id ? 'not-allowed' : 'pointer',
                              fontWeight: 600,
                              opacity: cancelingId === order._id ? 0.7 : 1
                            }}
                          >
                            {cancelingId === order._id ? 'Đang hủy...' : 'Hủy đơn'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <>
                      <div className="order-card-body">
                        <p>
                          <strong>Khách hàng:</strong>{' '}
                          {order.customerInfo?.fullName || order.customer?.name || 'Chưa có'}
                        </p>

                        <p>
                          <strong>Số điện thoại:</strong>{' '}
                          {order.customerInfo?.phone || order.customer?.phone || 'Chưa có'}
                        </p>

                        <p>
                          <strong>Địa chỉ:</strong>{' '}
                          {order.customerInfo?.address || 'Chưa có'}
                        </p>

                        <p>
                          <strong>Ghi chú:</strong>{' '}
                          {order.customerInfo?.note || 'Không có'}
                        </p>

                        <p>
                          <strong>Phương thức thanh toán:</strong>{' '}
                          {getPaymentMethodText(order.customerInfo?.paymentMethod)}
                        </p>

                        <p>
                          <strong>Trạng thái thanh toán:</strong>{' '}
                          {order.paymentStatus || 'Chưa có'}
                        </p>

                        <p>
                          <strong>Tạm tính:</strong>{' '}
                          {formatMoney(order.subtotal || 0)} đ
                        </p>

                        <p>
                          <strong>Giảm giá voucher:</strong>{' '}
                          - {formatMoney(order.discount || 0)} đ
                        </p>

                        <p>
                          <strong>Phí vận chuyển:</strong>{' '}
                          {formatMoney(order.shippingFee || 0)} đ
                        </p>

                        <p>
                          <strong>Tổng tiền:</strong>{' '}
                          {formatMoney(order.total || 0)} đ
                        </p>

                        <p>
                          <strong>Mã giảm giá:</strong>{' '}
                          {order.voucherCode || 'Không có'}
                        </p>
                      </div>

                      <div className="order-items-box">
                        <h4>Sản phẩm trong đơn</h4>

                        {order.items?.map((item, index) => {
                          const productId = item?.product?._id;
                          const reviewKey = getReviewKey(order._id, productId);
                          const reviewDraft =
                            reviewDrafts[reviewKey] || getDefaultReviewDraft();
                          const canReviewItem =
                            Boolean(order.canReview) && Boolean(productId);
                          const alreadyReviewed =
                            Boolean(item?.hasReviewed) || Boolean(reviewDraft.submitted);

                          return (
                            <div className="order-item-row" key={index}>
                              <img
                                src={renderImageSrc(item.product?.image)}
                                alt={item.product?.name || 'product'}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />

                              <div style={{ flex: 1 }}>
                                <p>
                                  <strong>{item.product?.name || 'Chưa có tên'}</strong>
                                </p>
                                <p>Số lượng: {item.quantity || 0}</p>
                                <p>Đơn giá: {formatMoney(item.product?.price || 0)} đ</p>
                                <p>
                                  Thành tiền:{' '}
                                  {formatMoney(
                                    Number(item.product?.price || 0) *
                                      Number(item.quantity || 0)
                                  )}{' '}
                                  đ
                                </p>

                                <div
                                  style={{
                                    marginTop: '10px',
                                    display: 'flex',
                                    gap: '10px',
                                    flexWrap: 'wrap',
                                    alignItems: 'center'
                                  }}
                                >
                                  {productId && (
                                    <Link
                                      to={`/product/${productId}`}
                                      style={{
                                        color: '#2563eb',
                                        textDecoration: 'none',
                                        fontWeight: 600
                                      }}
                                    >
                                      Xem chi tiết sản phẩm
                                    </Link>
                                  )}

                                  {canReviewItem && !alreadyReviewed && (
                                    <button
                                      type="button"
                                      onClick={() => toggleReviewForm(order._id, productId)}
                                      style={{
                                        background: '#ec4899',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                      }}
                                    >
                                      {reviewDraft.open ? 'Ẩn form đánh giá' : 'Đánh giá sản phẩm'}
                                    </button>
                                  )}

                                  {alreadyReviewed && (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '7px 12px',
                                        borderRadius: '999px',
                                        background: '#ecfdf5',
                                        color: '#059669',
                                        fontWeight: 700,
                                        fontSize: '14px'
                                      }}
                                    >
                                      Đã đánh giá
                                    </span>
                                  )}
                                </div>

                                {!order.canReview && (
                                  <p
                                    style={{
                                      marginTop: '10px',
                                      color: '#666',
                                      fontSize: '14px'
                                    }}
                                  >
                                    Bạn có thể đánh giá khi đơn hàng đã được xác nhận hoặc hoàn thành.
                                  </p>
                                )}

                                {reviewDraft.successMessage && (
                                  <p
                                    style={{
                                      marginTop: '10px',
                                      color: '#059669',
                                      fontWeight: 600
                                    }}
                                  >
                                    {reviewDraft.successMessage}
                                  </p>
                                )}

                                {reviewDraft.open && !alreadyReviewed && (
                                  <div
                                    style={{
                                      marginTop: '12px',
                                      padding: '14px',
                                      border: '1px solid #f3d1df',
                                      borderRadius: '12px',
                                      background: '#fff8fb'
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        gap: '12px',
                                        flexWrap: 'wrap',
                                        marginBottom: '12px'
                                      }}
                                    >
                                      <div>
                                        <label
                                          style={{
                                            display: 'block',
                                            marginBottom: '6px',
                                            fontWeight: 600
                                          }}
                                        >
                                          Số sao
                                        </label>
                                        <select
                                          className="review-rating-select"
                                          value={String(reviewDraft.rating || '5')}
                                          onChange={(e) =>
                                            handleReviewFieldChange(
                                              order._id,
                                              productId,
                                              'rating',
                                              e.target.value
                                            )
                                          }
                                        >
                                          <option value="5">5 sao</option>
                                          <option value="4">4 sao</option>
                                          <option value="3">3 sao</option>
                                          <option value="2">2 sao</option>
                                          <option value="1">1 sao</option>
                                        </select>
                                      </div>
                                    </div>

                                    <div>
                                      <label
                                        style={{
                                          display: 'block',
                                          marginBottom: '6px',
                                          fontWeight: 600
                                        }}
                                      >
                                        Nội dung đánh giá
                                      </label>
                                      <textarea
                                        value={reviewDraft.comment}
                                        onChange={(e) =>
                                          handleReviewFieldChange(
                                            order._id,
                                            productId,
                                            'comment',
                                            e.target.value
                                          )
                                        }
                                        placeholder="Hãy chia sẻ cảm nhận của bạn về sản phẩm..."
                                        rows={4}
                                        style={{
                                          width: '100%',
                                          resize: 'vertical',
                                          padding: '12px',
                                          borderRadius: '10px',
                                          border: '1px solid #ddd',
                                          outline: 'none',
                                          fontFamily: 'inherit'
                                        }}
                                      />
                                    </div>

                                    {reviewDraft.errorMessage && (
                                      <p
                                        style={{
                                          marginTop: '10px',
                                          color: '#dc2626',
                                          fontWeight: 600
                                        }}
                                      >
                                        {reviewDraft.errorMessage}
                                      </p>
                                    )}

                                    <div
                                      style={{
                                        marginTop: '12px',
                                        display: 'flex',
                                        gap: '10px',
                                        flexWrap: 'wrap'
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleSubmitReview(order._id, productId)}
                                        disabled={reviewDraft.submitting}
                                        style={{
                                          background: '#111827',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '8px',
                                          padding: '10px 14px',
                                          cursor: reviewDraft.submitting ? 'not-allowed' : 'pointer',
                                          fontWeight: 600,
                                          opacity: reviewDraft.submitting ? 0.7 : 1
                                        }}
                                      >
                                        {reviewDraft.submitting
                                          ? 'Đang gửi đánh giá...'
                                          : 'Gửi đánh giá'}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => toggleReviewForm(order._id, productId)}
                                        disabled={reviewDraft.submitting}
                                        style={{
                                          background: '#f3f4f6',
                                          color: '#111827',
                                          border: 'none',
                                          borderRadius: '8px',
                                          padding: '10px 14px',
                                          cursor: reviewDraft.submitting ? 'not-allowed' : 'pointer',
                                          fontWeight: 600
                                        }}
                                      >
                                        Đóng
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <InformComponent />
    </div>
  );
}

export default MyOrdersComponent;