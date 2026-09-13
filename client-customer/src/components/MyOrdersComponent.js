import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Link,
  useNavigate
} from 'react-router-dom';

import API from '../services/api';

import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

const STATUS_OPTIONS = [
  {
    value: 'all',
    label: 'Tất cả'
  },
  {
    value: 'pending',
    label: 'Chờ xác nhận'
  },
  {
    value: 'approved',
    label: 'Đã xác nhận'
  },
  {
    value: 'preparing',
    label: 'Đang chuẩn bị'
  },
  {
    value: 'delivering',
    label: 'Đang giao'
  },
  {
    value: 'completed',
    label: 'Hoàn thành'
  },
  {
    value: 'canceled',
    label: 'Đã hủy'
  }
];

function formatMoney(value) {
  return Number(
    value || 0
  ).toLocaleString('vi-VN');
}

function formatOrderDate(value) {
  if (!value) {
    return 'Chưa có';
  }

  const numericValue =
    Number(value);

  let date;

  if (
    Number.isFinite(numericValue) &&
    String(value).trim() !== ''
  ) {
    date =
      new Date(
        numericValue
      );
  } else {
    date =
      new Date(
        value
      );
  }

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Chưa có';
  }

  return date.toLocaleString(
    'vi-VN'
  );
}

function getReviewKey(
  orderId,
  productId
) {
  return `${String(
    orderId || ''
  )}__${String(
    productId || ''
  )}`;
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
  const [
    orders,
    setOrders
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    cancelingId,
    setCancelingId
  ] = useState('');

  const [
    statusFilter,
    setStatusFilter
  ] = useState('all');

  const [
    searchKeyword,
    setSearchKeyword
  ] = useState('');

  const [
    expandedOrders,
    setExpandedOrders
  ] = useState({});

  const [
    reviewDrafts,
    setReviewDrafts
  ] = useState({});

  const navigate =
    useNavigate();

  const clearCustomerSession =
    useCallback(() => {
      localStorage.removeItem(
        'customerToken'
      );

      localStorage.removeItem(
        'customer'
      );

      localStorage.removeItem(
        'cart'
      );

      localStorage.removeItem(
        'cartDiscount'
      );

      localStorage.removeItem(
        'cartVoucherCode'
      );

      localStorage.removeItem(
        'cartVoucherInfo'
      );
    }, []);

  const forceLogout =
    useCallback(
      message => {
        clearCustomerSession();

        alert(message);

        navigate(
          '/login',
          {
            replace: true
          }
        );
      },
      [
        clearCustomerSession,
        navigate
      ]
    );

  const handleCustomerApiError =
    useCallback(
      (
        error,
        fallbackMessage
      ) => {
        const status =
          error.response?.status;

        const code =
          error.response
            ?.data?.code;

        const message =
          error.response
            ?.data?.message ||
          error.response
            ?.data?.error ||
          fallbackMessage ||
          'Có lỗi xảy ra.';

        if (
          status === 403 &&
          code ===
            'ACCOUNT_LOCKED'
        ) {
          forceLogout(
            'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.'
          );

          return true;
        }

        if (
          status === 403 &&
          code ===
            'ACCOUNT_INACTIVE'
        ) {
          forceLogout(
            'Tài khoản của bạn chưa được kích hoạt.'
          );

          return true;
        }

        if (
          status === 401 ||
          code ===
            'INVALID_TOKEN' ||
          message ===
            'Token is not valid' ||
          message ===
            'Token has expired' ||
          message ===
            'Auth token is not supplied'
        ) {
          forceLogout(
            'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.'
          );

          return true;
        }

        return false;
      },
      [forceLogout]
    );

  const fetchOrders =
    useCallback(
      async () => {
        const token =
          localStorage.getItem(
            'customerToken'
          );

        if (!token) {
          alert(
            'Vui lòng đăng nhập để xem đơn hàng.'
          );

          navigate(
            '/login'
          );

          return;
        }

        try {
          setLoading(true);

          const res =
            await API.get(
              '/customer/orders',
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,

                  'Content-Type':
                    'application/json'
                }
              }
            );

          if (
            res.data?.success ===
            false
          ) {
            console.error(
              'API orders lỗi:',
              res.data
            );

            setOrders([]);

            return;
          }

          const data =
            Array.isArray(
              res.data
            )
              ? res.data
              : Array.isArray(
                    res.data
                      ?.orders
                  )
                ? res.data.orders
                : [];

          const sortedOrders =
            [...data].sort(
              (
                a,
                b
              ) =>
                Number(
                  b?.cdate ||
                  0
                ) -
                Number(
                  a?.cdate ||
                  0
                )
            );

          setOrders(
            sortedOrders
          );

          const initialExpanded =
            {};

          sortedOrders.forEach(
            (
              order,
              index
            ) => {
              if (
                index === 0
              ) {
                initialExpanded[
                  order._id
                ] = true;
              }
            }
          );

          setExpandedOrders(
            initialExpanded
          );
        } catch (error) {
          console.error(
            'Lỗi khi lấy đơn hàng:',
            error
          );

          console.error(
            'STATUS:',
            error.response?.status
          );

          console.error(
            'DATA:',
            error.response?.data
          );

          const handled =
            handleCustomerApiError(
              error,
              'Không thể tải đơn hàng. Vui lòng thử lại sau.'
            );

          if (handled) {
            return;
          }

          alert(
            error.response
              ?.data?.message ||
            'Không thể tải đơn hàng. Vui lòng thử lại sau.'
          );

          setOrders([]);
        } finally {
          setLoading(false);
        }
      },
      [
        navigate,
        handleCustomerApiError
      ]
    );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusText =
    status => {
      const normalized =
        String(
          status || ''
        ).toLowerCase();

      switch (
        normalized
      ) {
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
          return (
            status ||
            'Chờ xử lý'
          );
      }
    };

  const getStatusClass =
    status => {
      const normalized =
        String(
          status || ''
        ).toLowerCase();

      const supported = [
        'pending',
        'approved',
        'preparing',
        'delivering',
        'completed',
        'canceled'
      ];

      if (
        supported.includes(
          normalized
        )
      ) {
        return (
          `wf-order-status ` +
          `wf-order-status--${normalized}`
        );
      }

      return 'wf-order-status';
    };

  const getPaymentMethodText =
    paymentMethod => {
      if (
        paymentMethod ===
        'cod'
      ) {
        return 'Thanh toán khi nhận hàng';
      }

      if (
        paymentMethod ===
        'bank'
      ) {
        return 'Chuyển khoản ngân hàng';
      }

      if (
        paymentMethod ===
        'momo'
      ) {
        return 'Ví điện tử MoMo';
      }

      return 'Chưa có';
    };

  const renderImageSrc =
    img => {
      if (!img) {
        return '';
      }

      if (
        img.startsWith(
          'data:image'
        )
      ) {
        return img;
      }

      if (
        img.startsWith(
          'http://'
        ) ||
        img.startsWith(
          'https://'
        )
      ) {
        return img;
      }

      return img;
    };

  const canCancelOrder =
    status => {
      return (
        String(
          status || ''
        ).toLowerCase() ===
        'pending'
      );
    };

  const toggleOrderDetails =
    orderId => {
      setExpandedOrders(
        previous => ({
          ...previous,

          [orderId]:
            !previous[
              orderId
            ]
        })
      );
    };

  const toggleReviewForm = (
    orderId,
    productId
  ) => {
    const key =
      getReviewKey(
        orderId,
        productId
      );

    setReviewDrafts(
      previous => {
        const current =
          previous[key] ||
          getDefaultReviewDraft();

        return {
          ...previous,

          [key]: {
            ...current,

            open:
              !current.open,

            errorMessage:
              '',

            successMessage:
              current.submitted
                ? current.successMessage
                : ''
          }
        };
      }
    );
  };

  const handleReviewFieldChange = (
    orderId,
    productId,
    field,
    value
  ) => {
    const key =
      getReviewKey(
        orderId,
        productId
      );

    setReviewDrafts(
      previous => {
        const current =
          previous[key] ||
          getDefaultReviewDraft();

        return {
          ...previous,

          [key]: {
            ...current,

            [field]:
              value,

            errorMessage:
              '',

            successMessage:
              ''
          }
        };
      }
    );
  };

  const handleSubmitReview =
    async (
      orderId,
      productId
    ) => {
      const token =
        localStorage.getItem(
          'customerToken'
        );

      if (!token) {
        alert(
          'Vui lòng đăng nhập lại.'
        );

        navigate(
          '/login'
        );

        return;
      }

      const key =
        getReviewKey(
          orderId,
          productId
        );

      const current =
        reviewDrafts[key] ||
        getDefaultReviewDraft();

      const rating =
        Number(
          current.rating ||
          5
        );

      const comment =
        String(
          current.comment ||
          ''
        ).trim();

      if (!comment) {
        setReviewDrafts(
          previous => ({
            ...previous,

            [key]: {
              ...current,

              open: true,

              errorMessage:
                'Vui lòng nhập nội dung đánh giá.'
            }
          })
        );

        return;
      }

      try {
        setReviewDrafts(
          previous => ({
            ...previous,

            [key]: {
              ...current,

              open: true,

              submitting:
                true,

              errorMessage:
                '',

              successMessage:
                ''
            }
          })
        );

        const res =
          await API.post(
            '/customer/reviews',
            {
              orderId,
              productId,
              rating,
              comment
            },
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,

                'Content-Type':
                  'application/json'
              }
            }
          );

        if (
          res.data?.success ===
          false
        ) {
          setReviewDrafts(
            previous => ({
              ...previous,

              [key]: {
                ...(previous[
                  key
                ] ||
                  getDefaultReviewDraft()),

                open: true,

                submitting:
                  false,

                errorMessage:
                  res.data
                    ?.message ||
                  'Không thể gửi đánh giá.'
              }
            })
          );

          return;
        }

        setReviewDrafts(
          previous => ({
            ...previous,

            [key]: {
              open: false,

              rating: '5',

              comment: '',

              submitting:
                false,

              submitted:
                true,

              successMessage:
                res.data
                  ?.message ||
                'Đánh giá sản phẩm thành công.',

              errorMessage:
                ''
            }
          })
        );

        setOrders(
          previous =>
            previous.map(
              order => {
                if (
                  String(
                    order._id
                  ) !==
                  String(
                    orderId
                  )
                ) {
                  return order;
                }

                return {
                  ...order,

                  items:
                    (
                      Array.isArray(
                        order.items
                      )
                        ? order.items
                        : []
                    ).map(
                      item => {
                        if (
                          String(
                            item
                              ?.product
                              ?._id ||
                            ''
                          ) !==
                          String(
                            productId
                          )
                        ) {
                          return item;
                        }

                        return {
                          ...item,

                          hasReviewed:
                            true
                        };
                      }
                    )
                };
              }
            )
        );
      } catch (error) {
        console.error(
          'REVIEW ERROR:',
          error
        );

        const handled =
          handleCustomerApiError(
            error,
            'Không thể gửi đánh giá. Vui lòng thử lại sau.'
          );

        if (handled) {
          return;
        }

        setReviewDrafts(
          previous => ({
            ...previous,

            [key]: {
              ...(previous[
                key
              ] ||
                getDefaultReviewDraft()),

              open: true,

              submitting:
                false,

              errorMessage:
                error.response
                  ?.data
                  ?.message ||
                'Không thể gửi đánh giá. Vui lòng thử lại sau.'
            }
          })
        );
      }
    };

  const handleCancelOrder =
    async orderId => {
      const token =
        localStorage.getItem(
          'customerToken'
        );

      if (!token) {
        alert(
          'Vui lòng đăng nhập lại.'
        );

        navigate(
          '/login'
        );

        return;
      }

      const confirmed =
        window.confirm(
          'Bạn có chắc muốn hủy đơn này không? Chỉ đơn đang chờ xác nhận mới được hủy.'
        );

      if (!confirmed) {
        return;
      }

      try {
        setCancelingId(
          orderId
        );

        const res =
          await API.put(
            `/customer/orders/${orderId}/cancel`,
            {},
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,

                'Content-Type':
                  'application/json'
              }
            }
          );

        if (
          res.data?.success ===
          false
        ) {
          alert(
            res.data
              ?.message ||
            'Không thể hủy đơn hàng.'
          );

          return;
        }

        alert(
          res.data?.message ||
          'Hủy đơn hàng thành công.'
        );

        setOrders(
          previous =>
            previous.map(
              order =>
                order._id ===
                orderId
                  ? {
                      ...order,

                      status:
                        'canceled'
                    }
                  : order
            )
        );
      } catch (error) {
        console.error(
          'CANCEL ORDER ERROR:',
          error
        );

        const handled =
          handleCustomerApiError(
            error,
            'Không thể hủy đơn hàng. Vui lòng thử lại sau.'
          );

        if (handled) {
          return;
        }

        alert(
          error.response
            ?.data?.message ||
          'Không thể hủy đơn hàng. Vui lòng thử lại sau.'
        );
      } finally {
        setCancelingId(
          ''
        );
      }
    };

  const filteredOrders =
    useMemo(() => {
      const keyword =
        String(
          searchKeyword ||
          ''
        )
          .trim()
          .toLowerCase();

      return orders.filter(
        order => {
          const status =
            String(
              order
                ?.status ||
              ''
            ).toLowerCase();

          const orderId =
            String(
              order?._id ||
              ''
            ).toLowerCase();

          const matchStatus =
            statusFilter ===
            'all'
              ? true
              : status ===
                statusFilter;

          const matchKeyword =
            keyword
              ? orderId.includes(
                  keyword
                )
              : true;

          return (
            matchStatus &&
            matchKeyword
          );
        }
      );
    }, [
      orders,
      searchKeyword,
      statusFilter
    ]);

  return (
    <div className="wf-orders-page-shell">
      <MenuComponent />

      <main className="container wf-orders-page">
        <header className="wf-orders-header">
          <div>
            <span className="wf-orders-eyebrow">
              WIND FLOWER
            </span>

            <h1>
              Đơn hàng của tôi
            </h1>

            <p>
              Theo dõi đơn hàng,
              thông tin giao hoa và
              đánh giá sản phẩm đã mua.
            </p>
          </div>

          <Link
            to="/"
            className="wf-orders-back-button"
          >
            ← Tiếp tục mua hoa
          </Link>
        </header>

        <section className="wf-orders-filter-card">
          <div className="wf-orders-search">
            <label htmlFor="order-search">
              Tìm đơn hàng
            </label>

            <input
              id="order-search"
              type="search"
              placeholder="Nhập mã đơn..."
              value={
                searchKeyword
              }
              onChange={
                event =>
                  setSearchKeyword(
                    event.target.value
                  )
              }
            />
          </div>

          <div className="wf-orders-status-filter">
            <span className="wf-orders-filter-label">
              Trạng thái
            </span>

            <div className="wf-orders-status-chips">
              {STATUS_OPTIONS.map(
                option => (
                  <button
                    type="button"
                    key={
                      option.value
                    }
                    className={
                      statusFilter ===
                      option.value
                        ? 'wf-orders-status-chip active'
                        : 'wf-orders-status-chip'
                    }
                    aria-pressed={
                      statusFilter ===
                      option.value
                    }
                    onClick={() =>
                      setStatusFilter(
                        option.value
                      )
                    }
                  >
                    {
                      option.label
                    }
                  </button>
                )
              )}
            </div>
          </div>

          <div className="wf-orders-filter-result">
            Hiển thị{' '}
            <strong>
              {
                filteredOrders.length
              }
            </strong>
            {' / '}
            {
              orders.length
            }{' '}
            đơn hàng
          </div>
        </section>

        {loading ? (
          <section className="wf-orders-empty">
            <div className="wf-orders-empty-icon">
              📦
            </div>

            <h2>
              Đang tải đơn hàng...
            </h2>

            <p>
              Wind Flower đang lấy
              thông tin đơn hàng của bạn.
            </p>
          </section>
        ) : filteredOrders.length ===
          0 ? (
          <section className="wf-orders-empty">
            <div className="wf-orders-empty-icon">
              🧾
            </div>

            <h2>
              Không tìm thấy đơn hàng
            </h2>

            <p>
              Không có đơn hàng phù hợp
              với bộ lọc hiện tại.
            </p>

            <Link
              to="/"
              className="wf-orders-empty-button"
            >
              Tiếp tục mua sắm
            </Link>
          </section>
        ) : (
          <div className="wf-orders-list">
            {filteredOrders.map(
              order => {
                const isExpanded =
                  Boolean(
                    expandedOrders[
                      order._id
                    ]
                  );

                const isPending =
                  canCancelOrder(
                    order.status
                  );

                return (
                  <article
                    className="wf-order-card"
                    key={
                      order._id
                    }
                  >
                    <div className="wf-order-card-header">
                      <div className="wf-order-main-info">
                        <span className="wf-order-label">
                          MÃ ĐƠN HÀNG
                        </span>

                        <h2>
                          {
                            order._id
                          }
                        </h2>

                        <div className="wf-order-meta">
                          <span>
                            Ngày đặt:{' '}
                            <strong>
                              {formatOrderDate(
                                order.cdate
                              )}
                            </strong>
                          </span>

                          <span>
                            Tổng tiền:{' '}
                            <strong>
                              {formatMoney(
                                order.total
                              )}{' '}
                              đ
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="wf-order-header-actions">
                        <span
                          className={
                            getStatusClass(
                              order.status
                            )
                          }
                        >
                          {getStatusText(
                            order.status
                          )}
                        </span>

                        <div className="wf-order-action-buttons">
                          <button
                            type="button"
                            className="wf-order-detail-button"
                            aria-expanded={
                              isExpanded
                            }
                            onClick={() =>
                              toggleOrderDetails(
                                order._id
                              )
                            }
                          >
                            {isExpanded
                              ? 'Ẩn chi tiết'
                              : 'Xem chi tiết'}
                          </button>

                          {isPending && (
                            <button
                              type="button"
                              className="wf-order-cancel-button"
                              onClick={() =>
                                handleCancelOrder(
                                  order._id
                                )
                              }
                              disabled={
                                cancelingId ===
                                order._id
                              }
                            >
                              {cancelingId ===
                              order._id
                                ? 'Đang hủy...'
                                : 'Hủy đơn'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="wf-order-expanded">
                        <section className="wf-order-details-section">
                          <div className="wf-order-section-heading">
                            <span>
                              THÔNG TIN
                            </span>

                            <h3>
                              Chi tiết giao hàng
                            </h3>
                          </div>

                          <div className="wf-order-details-grid">
                            <div className="wf-order-detail-item">
                              <span>
                                Ngày giao hoa
                              </span>

                              <strong>
                                {order.deliveryDate ||
                                  '—'}
                              </strong>
                            </div>

                            <div className="wf-order-detail-item">
                              <span>
                                Khung giờ giao mong muốn
                              </span>

                              <strong>
                                {order.deliveryTimeSlot ||
                                  '—'}
                              </strong>
                            </div>

                            <div className="wf-order-detail-item">
                              <span>
                                Khách hàng
                              </span>

                              <strong>
                                {order.customerInfo
                                  ?.fullName ||
                                  order.customer
                                    ?.name ||
                                  'Chưa có'}
                              </strong>
                            </div>

                            <div className="wf-order-detail-item">
                              <span>
                                Số điện thoại
                              </span>

                              <strong>
                                {order.customerInfo
                                  ?.phone ||
                                  order.customer
                                    ?.phone ||
                                  'Chưa có'}
                              </strong>
                            </div>

                            <div className="wf-order-detail-item wf-order-detail-item-wide">
                              <span>
                                Địa chỉ
                              </span>

                              <strong>
                                {order.customerInfo
                                  ?.address ||
                                  'Chưa có'}
                              </strong>
                            </div>

                            <div className="wf-order-detail-item wf-order-detail-item-wide">
                              <span>
                                Lời nhắn thiệp
                              </span>

                              <strong className="wf-order-preserve-text">
                                {order.cardMessage ||
                                  '—'}
                              </strong>
                            </div>

                            <div className="wf-order-detail-item wf-order-detail-item-wide">
                              <span>
                                Ghi chú cho shop
                              </span>

                              <strong className="wf-order-preserve-text">
                                {order.customerInfo
                                  ?.note ||
                                  'Không có'}
                              </strong>
                            </div>
                          </div>
                        </section>

                        <section className="wf-order-details-section">
                          <div className="wf-order-section-heading">
                            <span>
                              THANH TOÁN
                            </span>

                            <h3>
                              Tóm tắt đơn hàng
                            </h3>
                          </div>

                          <div className="wf-order-payment-grid">
                            <div className="wf-order-payment-row">
                              <span>
                                Phương thức
                              </span>

                              <strong>
                                {getPaymentMethodText(
                                  order.customerInfo
                                    ?.paymentMethod
                                )}
                              </strong>
                            </div>

                            <div className="wf-order-payment-row">
                              <span>
                                Trạng thái thanh toán
                              </span>

                              <strong>
                                {order.paymentStatus === 'Đã thanh toán demo'
                                  ? 'Thanh toán demo - chưa xác minh (dữ liệu cũ)'
                                  : order.paymentStatus || 'Chưa có'}
                              </strong>
                            </div>

                            <div className="wf-order-payment-row">
                              <span>
                                Tạm tính
                              </span>

                              <strong>
                                {formatMoney(
                                  order.subtotal ||
                                    0
                                )}{' '}
                                đ
                              </strong>
                            </div>

                            <div className="wf-order-payment-row">
                              <span>
                                Voucher
                              </span>

                              <strong>
                                -{' '}
                                {formatMoney(
                                  order.discount ||
                                    0
                                )}{' '}
                                đ
                              </strong>
                            </div>

                            <div className="wf-order-payment-row">
                              <span>
                                Phí vận chuyển
                              </span>

                              <strong>
                                {formatMoney(
                                  order.shippingFee ||
                                    0
                                )}{' '}
                                đ
                              </strong>
                            </div>

                            <div className="wf-order-payment-row">
                              <span>
                                Mã giảm giá
                              </span>

                              <strong>
                                {order.voucherCode ||
                                  'Không có'}
                              </strong>
                            </div>

                            <div className="wf-order-payment-total">
                              <span>
                                Tổng thanh toán
                              </span>

                              <strong>
                                {formatMoney(
                                  order.total ||
                                    0
                                )}{' '}
                                đ
                              </strong>
                            </div>
                          </div>
                        </section>

                        <section className="wf-order-products-section">
                          <div className="wf-order-section-heading">
                            <span>
                              SẢN PHẨM
                            </span>

                            <h3>
                              Sản phẩm trong đơn
                            </h3>
                          </div>

                          <div className="wf-order-products-list">
                            {order.items?.map(
                              (
                                item,
                                index
                              ) => {
                                const productId =
                                  item
                                    ?.product
                                    ?._id;

                                const reviewKey =
                                  getReviewKey(
                                    order._id,
                                    productId
                                  );

                                const reviewDraft =
                                  reviewDrafts[
                                    reviewKey
                                  ] ||
                                  getDefaultReviewDraft();

                                const canReviewItem =
                                  Boolean(
                                    order.canReview
                                  ) &&
                                  Boolean(
                                    productId
                                  );

                                const alreadyReviewed =
                                  Boolean(
                                    item
                                      ?.hasReviewed
                                  ) ||
                                  Boolean(
                                    reviewDraft.submitted
                                  );

                                const quantity =
                                  Number(
                                    item.quantity ||
                                    0
                                  );

                                const unitPrice =
                                  Number(
                                    item.product
                                      ?.price ||
                                    0
                                  );

                                return (
                                  <article
                                    className="wf-order-product"
                                    key={
                                      `${order._id}-${productId || index}`
                                    }
                                  >
                                    <div className="wf-order-product-image-wrap">
                                      <img
                                        src={renderImageSrc(
                                          item.product
                                            ?.image
                                        )}
                                        alt={
                                          item.product
                                            ?.name ||
                                          'Sản phẩm'
                                        }
                                        className="wf-order-product-image"
                                        onError={
                                          event => {
                                            event.currentTarget.style.display =
                                              'none';
                                          }
                                        }
                                      />
                                    </div>

                                    <div className="wf-order-product-content">
                                      <div className="wf-order-product-main">
                                        <div>
                                          <h4>
                                            {item.product
                                              ?.name ||
                                              'Chưa có tên'}
                                          </h4>

                                          <div className="wf-order-product-price-info">
                                            <span>
                                              Số lượng:{' '}
                                              <strong>
                                                {
                                                  quantity
                                                }
                                              </strong>
                                            </span>

                                            <span>
                                              Đơn giá:{' '}
                                              <strong>
                                                {formatMoney(
                                                  unitPrice
                                                )}{' '}
                                                đ
                                              </strong>
                                            </span>

                                            <span>
                                              Thành tiền:{' '}
                                              <strong>
                                                {formatMoney(
                                                  unitPrice *
                                                    quantity
                                                )}{' '}
                                                đ
                                              </strong>
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="wf-order-product-actions">
                                        {productId && (
                                          <Link
                                            to={`/product/${productId}`}
                                            className="wf-order-product-link"
                                          >
                                            Xem sản phẩm
                                          </Link>
                                        )}

                                        {canReviewItem &&
                                          !alreadyReviewed && (
                                            <button
                                              type="button"
                                              className="wf-order-review-button"
                                              onClick={() =>
                                                toggleReviewForm(
                                                  order._id,
                                                  productId
                                                )
                                              }
                                            >
                                              {reviewDraft.open
                                                ? 'Ẩn đánh giá'
                                                : 'Đánh giá sản phẩm'}
                                            </button>
                                          )}

                                        {alreadyReviewed && (
                                          <span className="wf-order-reviewed-badge">
                                            ✓ Đã đánh giá
                                          </span>
                                        )}
                                      </div>

                                      {!order.canReview &&
                                        !alreadyReviewed && (
                                          <p className="wf-order-review-note">
                                            Đánh giá sẽ mở khi
                                            đơn hàng đủ điều kiện.
                                          </p>
                                        )}

                                      {reviewDraft.successMessage && (
                                        <div className="wf-order-review-success">
                                          {
                                            reviewDraft.successMessage
                                          }
                                        </div>
                                      )}

                                      {reviewDraft.open &&
                                        !alreadyReviewed && (
                                          <div className="wf-order-review-form">
                                            <div className="wf-order-review-field">
                                              <label>
                                                Số sao
                                              </label>

                                              <div className="wf-order-rating-buttons">
                                                {[1, 2, 3, 4, 5].map(
                                                  rating => (
                                                    <button
                                                      type="button"
                                                      key={
                                                        rating
                                                      }
                                                      className={
                                                        Number(
                                                          reviewDraft.rating
                                                        ) ===
                                                        rating
                                                          ? 'active'
                                                          : ''
                                                      }
                                                      aria-label={`${rating} sao`}
                                                      aria-pressed={
                                                        Number(
                                                          reviewDraft.rating
                                                        ) ===
                                                        rating
                                                      }
                                                      onClick={() =>
                                                        handleReviewFieldChange(
                                                          order._id,
                                                          productId,
                                                          'rating',
                                                          String(
                                                            rating
                                                          )
                                                        )
                                                      }
                                                    >
                                                      ★
                                                      <span>
                                                        {
                                                          rating
                                                        }
                                                      </span>
                                                    </button>
                                                  )
                                                )}
                                              </div>
                                            </div>

                                            <div className="wf-order-review-field">
                                              <label
                                                htmlFor={`review-${order._id}-${productId}`}
                                              >
                                                Nội dung đánh giá
                                              </label>

                                              <textarea
                                                id={`review-${order._id}-${productId}`}
                                                value={
                                                  reviewDraft.comment
                                                }
                                                onChange={
                                                  event =>
                                                    handleReviewFieldChange(
                                                      order._id,
                                                      productId,
                                                      'comment',
                                                      event.target.value
                                                    )
                                                }
                                                placeholder="Hãy chia sẻ cảm nhận của bạn về sản phẩm..."
                                                rows={4}
                                              />
                                            </div>

                                            {reviewDraft.errorMessage && (
                                              <div
                                                className="wf-order-review-error"
                                                role="alert"
                                              >
                                                {
                                                  reviewDraft.errorMessage
                                                }
                                              </div>
                                            )}

                                            <div className="wf-order-review-form-actions">
                                              <button
                                                type="button"
                                                className="wf-order-review-submit"
                                                onClick={() =>
                                                  handleSubmitReview(
                                                    order._id,
                                                    productId
                                                  )
                                                }
                                                disabled={
                                                  reviewDraft.submitting
                                                }
                                              >
                                                {reviewDraft.submitting
                                                  ? 'Đang gửi...'
                                                  : 'Gửi đánh giá'}
                                              </button>

                                              <button
                                                type="button"
                                                className="wf-order-review-close"
                                                onClick={() =>
                                                  toggleReviewForm(
                                                    order._id,
                                                    productId
                                                  )
                                                }
                                                disabled={
                                                  reviewDraft.submitting
                                                }
                                              >
                                                Đóng
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                    </div>
                                  </article>
                                );
                              }
                            )}
                          </div>
                        </section>
                      </div>
                    )}
                  </article>
                );
              }
            )}
          </div>
        )}
      </main>

      <InformComponent />
    </div>
  );
}

export default MyOrdersComponent;
