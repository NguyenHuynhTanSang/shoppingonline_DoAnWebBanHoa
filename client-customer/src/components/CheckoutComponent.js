import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';
import { DELIVERY_TIME_SLOTS, CARD_MESSAGE_LIMIT, vietnamToday, deliveryError } from '../services/delivery';


function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function getShippingFee(subtotal) {
  return Number(subtotal || 0) >= 1500000 ? 0 : 30000;
}

function normalizeCartItems(rawCart) {
  return (Array.isArray(rawCart) ? rawCart : [])
    .map((item) => ({
      _id: String(item._id || '').trim(),
      name: item.name || '',
      image: item.image || '',
      price: Number(item.price || 0),
      originalPrice: Number(item.originalPrice || item.price || 0),
      discountPercent: Number(item.discountPercent || 0),
      discountPrice: Number(item.discountPrice || 0),
      quantity: Number(item.quantity || 0)
    }))
    .filter((item) => isValidObjectId(item._id) && item.quantity > 0);
}

function CheckoutComponent() {
  const checkoutAttempt = useRef(null);
  const checkoutInFlight = useRef(false);
  const navigate = useNavigate();

  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherMessage, setVoucherMessage] = useState('');
  const [checkingVoucher, setCheckingVoucher] = useState(false);
  const [isPaidDemo, setIsPaidDemo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    note: '',
    deliveryDate: '',
    deliveryTimeSlot: '',
    cardMessage: '',
    paymentMethod: 'cod'
  });

  const clearVoucherStorage = useCallback(() => {
    localStorage.removeItem('cartDiscount');
    localStorage.removeItem('cartVoucherCode');
    localStorage.removeItem('cartVoucherInfo');
  }, []);

  const clearCustomerSession = useCallback(() => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customer');
    localStorage.removeItem('cart');
    clearVoucherStorage();
  }, [clearVoucherStorage]);

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

  useEffect(() => {
    const rawCart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartData = normalizeCartItems(rawCart);

    const savedDiscount = Number(localStorage.getItem('cartDiscount')) || 0;
    const savedVoucher = localStorage.getItem('cartVoucherCode') || '';

    const customerRaw = localStorage.getItem('customer');
    const customer = customerRaw ? JSON.parse(customerRaw) : null;
    const token = localStorage.getItem('customerToken');

    if (!customer || !token) {
      alert('Vui lòng đăng nhập để thanh toán.');
      navigate('/login');
      return;
    }

    setCart(cartData);
    setDiscount(savedDiscount);
    setVoucherCode(savedVoucher);

    setFormData((prev) => ({
      ...prev,
      fullName: customer.name || customer.fullName || '',
      phone: customer.phone || ''
    }));

    if (cartData.length === 0) {
      navigate('/cart');
    }
  }, [navigate]);

  useEffect(() => {
    setIsPaidDemo(false);
  }, [formData.paymentMethod]);

  const subtotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
  }, [cart]);

  const totalSavedOnProducts = useMemo(() => {
    return cart.reduce((sum, item) => {
      const originalPrice = Number(item.originalPrice || item.price || 0);
      const finalPrice = Number(item.price || 0);
      const qty = Number(item.quantity || 0);

      if (originalPrice > finalPrice) {
        return sum + (originalPrice - finalPrice) * qty;
      }

      return sum;
    }, 0);
  }, [cart]);

  const shippingFee = useMemo(() => getShippingFee(subtotal), [subtotal]);
  const finalTotal = Math.max(subtotal - discount + shippingFee, 0);

  const refreshVoucherFromServer = useCallback(
    async (code, cartItems) => {
      const safeCode = String(code || '').trim().toUpperCase();

      if (!safeCode || !Array.isArray(cartItems) || cartItems.length === 0) {
        setDiscount(0);
        setVoucherMessage('');
        clearVoucherStorage();
        return;
      }

      try {
        setCheckingVoucher(true);

        const payload = {
          voucherCode: safeCode,
          items: cartItems.map((item) => ({
            _id: item._id,
            quantity: Number(item.quantity || 0)
          }))
        };

        const res = await API.post('/customer/voucher/apply', payload, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const data = res.data || {};
        const newDiscount = Number(data.discount || 0);

        setDiscount(newDiscount);
        setVoucherCode(data.voucherCode || safeCode);
        setVoucherMessage(data.message || 'Voucher hợp lệ.');

        localStorage.setItem('cartDiscount', String(newDiscount));
        localStorage.setItem('cartVoucherCode', data.voucherCode || safeCode);
        localStorage.setItem(
          'cartVoucherInfo',
          JSON.stringify({
            voucher: data.voucher || null,
            subtotal: Number(data.subtotal || 0),
            discount: newDiscount,
            shippingFee: Number(data.shippingFee || 0),
            total: Number(data.total || 0)
          })
        );
      } catch (error) {
        console.error('REFRESH VOUCHER ERROR:', error);

        const handled = handleCustomerApiError(
          error,
          'Voucher không còn hợp lệ cho giỏ hàng hiện tại.'
        );
        if (handled) return;

        const message =
          error.response?.data?.message || 'Voucher không còn hợp lệ cho giỏ hàng hiện tại.';

        setDiscount(0);
        setVoucherMessage(message);
        clearVoucherStorage();
      } finally {
        setCheckingVoucher(false);
      }
    },
    [clearVoucherStorage, handleCustomerApiError]
  );

  useEffect(() => {
    if (cart.length === 0) return;

    const savedVoucher = localStorage.getItem('cartVoucherCode') || '';
    if (savedVoucher.trim()) {
      refreshVoucherFromServer(savedVoucher, cart);
    }
  }, [cart, refreshVoucherFromServer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (checkoutInFlight.current) return;

    const customerRaw = localStorage.getItem('customer');
    const customer = customerRaw ? JSON.parse(customerRaw) : null;
    const token = localStorage.getItem('customerToken');

    if (!customer || !token) {
      alert('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      clearCustomerSession();
      navigate('/login');
      return;
    }

    if (!formData.fullName.trim()) {
      alert('Vui lòng nhập họ và tên.');
      return;
    }

    if (!formData.phone.trim()) {
      alert('Vui lòng nhập số điện thoại.');
      return;
    }

    if (!formData.address.trim()) {
      alert('Vui lòng nhập địa chỉ nhận hàng.');
      return;
    }

    if (
      (formData.paymentMethod === 'bank' || formData.paymentMethod === 'momo') &&
      !isPaidDemo
    ) {
      alert('Vui lòng xác nhận mô phỏng thanh toán. Đây không phải xác minh giao dịch thật.');
      return;
    }

    if (!Array.isArray(cart) || cart.length === 0) {
      alert('Giỏ hàng đang trống.');
      navigate('/cart');
      return;
    }

    const validationMessage = deliveryError(formData);
    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    const payload = {
      deliveryDate: formData.deliveryDate,
      deliveryTimeSlot: formData.deliveryTimeSlot,
      cardMessage: formData.cardMessage.trim(),
      customerInfo: {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        note: formData.note.trim(),
        paymentMethod: formData.paymentMethod
      },
      items: cart.map((item) => ({
        _id: item._id,
        quantity: Number(item.quantity || 0)
      })),
      voucherCode: String(voucherCode || '').trim().toUpperCase()
    };

    try {
      const intent = JSON.stringify({ customer: customer._id || customer.username, ...payload,
        items: [...payload.items].sort((a, b) => a._id.localeCompare(b._id)) });
      if (!checkoutAttempt.current || checkoutAttempt.current.intent !== intent) {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        checkoutAttempt.current = { intent, key: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') };
      }
      checkoutInFlight.current = true;
      setSubmitting(true);

      const res = await API.post('/customer/checkout', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': checkoutAttempt.current.key
        }
      });

      if (!res.data || res.data.success === false) {
        alert(res.data?.message || 'Đặt hàng thất bại.');
        return;
      }

      const savedOrder = res.data.order || res.data.result;
      if (!savedOrder?._id) throw new Error('Unconfirmed checkout response');
      checkoutAttempt.current = null;

      localStorage.setItem('latestOrder', JSON.stringify(savedOrder));
      localStorage.removeItem('cart');
      clearVoucherStorage();

      alert('Đặt hàng thành công!');
      navigate('/order-success');
    } catch (error) {
      // Preserve the attempt key on uncertain responses; never log request credentials.

      const handled = handleCustomerApiError(
        error,
        'Không thể đặt hàng. Vui lòng kiểm tra backend hoặc đăng nhập lại.'
      );
      if (handled) return;

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Không thể đặt hàng. Vui lòng kiểm tra backend hoặc đăng nhập lại.';

      alert(message);
    } finally {
      checkoutInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div>
      <MenuComponent />

      <div className="container checkout-page">
        <div className="checkout-top">
          <h1>Thanh toán đơn hàng</h1>
          <Link to="/cart" className="back-home-btn">
            ← Quay lại giỏ hàng
          </Link>
        </div>

        <div className="checkout-layout">
          <div className="checkout-form-box">
            <h2>Thông tin khách hàng</h2>

            <form onSubmit={handlePlaceOrder} className="checkout-form">
              <div className="checkout-form-group">
                <label>Họ và tên</label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="Nhập họ và tên"
                  value={formData.fullName}
                  onChange={handleChange}
                />
              </div>

              <div className="checkout-form-group">
                <label>Số điện thoại</label>
                <input
                  type="text"
                  name="phone"
                  placeholder="Nhập số điện thoại"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="checkout-form-group">
                <label>Địa chỉ nhận hàng</label>
                <textarea
                  name="address"
                  rows="4"
                  placeholder="Nhập địa chỉ nhận hàng"
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>

              <div className="checkout-form-group">
                <h2>Thời gian &amp; lời nhắn</h2>
                <label htmlFor="delivery-date">Ngày giao hoa</label>
                <input id="delivery-date" name="deliveryDate" type="date" required min={vietnamToday()} value={formData.deliveryDate} onChange={handleChange} />
                <label htmlFor="delivery-slot">Khung giờ giao mong muốn</label>
                <select id="delivery-slot" name="deliveryTimeSlot" required value={formData.deliveryTimeSlot} onChange={handleChange} aria-describedby="delivery-slot-help">
                  <option value="">Chọn khung giờ</option>
                  {DELIVERY_TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot.replace('-', ' - ')}</option>)}
                </select>
                <p id="delivery-slot-help">Wind Flower sẽ cố gắng giao trong khung giờ bạn chọn.</p>
                <label htmlFor="card-message">Lời nhắn thiệp (không bắt buộc)</label>
                <textarea id="card-message" name="cardMessage" rows="3" maxLength={CARD_MESSAGE_LIMIT} value={formData.cardMessage} onChange={handleChange} placeholder="Chúc em sinh nhật vui vẻ!" aria-describedby="card-message-count" />
                <p id="card-message-count">Nội dung gửi người nhận · {formData.cardMessage.length}/{CARD_MESSAGE_LIMIT} ký tự</p>
                <label htmlFor="shop-note">Ghi chú cho shop</label>
                <textarea
                  id="shop-note"
                  name="note"
                  rows="3"
                  placeholder="Ví dụ: giao giờ hành chính, gọi trước khi giao..."
                  value={formData.note}
                  onChange={handleChange}
                />
              </div>

              <div className="checkout-form-group">
                <label>Phương thức thanh toán</label>

                <div className="payment-method-list">
                  <label className="payment-method-item">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={formData.paymentMethod === 'cod'}
                      onChange={handleChange}
                    />
                    Thanh toán khi nhận hàng (COD)
                  </label>

                  <label className="payment-method-item">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bank"
                      checked={formData.paymentMethod === 'bank'}
                      onChange={handleChange}
                    />
                    Chuyển khoản ngân hàng
                  </label>

                  <label className="payment-method-item">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="momo"
                      checked={formData.paymentMethod === 'momo'}
                      onChange={handleChange}
                    />
                    Ví điện tử MoMo
                  </label>
                </div>

                {formData.paymentMethod === 'cod' && (
                  <div className="payment-demo-box">
                    <p>
                      <strong>Thanh toán khi nhận hàng (COD)</strong>
                    </p>
                    <p>Quý khách sẽ thanh toán bằng tiền mặt khi nhận hàng.</p>
                  </div>
                )}

                {formData.paymentMethod !== 'cod' && (
                  <p>Thanh toán mô phỏng - chưa xác minh. Xác nhận bên dưới không chứng minh giao dịch thật.</p>
                )}
                {formData.paymentMethod === 'bank' && (
                  <div className="payment-demo-box">
                    <p>
                      <strong>Quét mã QR để chuyển khoản demo</strong>
                    </p>
                    <img
                      src="/images/qr-bank.png"
                      alt="QR chuyển khoản"
                      className="payment-qr"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <p>Ngân hàng: MB Bank</p>
                    <p>Số tài khoản: 123456789</p>
                    <p>Chủ tài khoản: WIND FLOWER</p>
                    <p>Nội dung: THANHTOAN {formData.phone || 'SODIENTHOAI'}</p>

                    <button
                      type="button"
                      className="demo-paid-btn"
                      onClick={() => setIsPaidDemo(true)}
                    >
                      Xác nhận mô phỏng chuyển khoản - chưa xác minh
                    </button>
                  </div>
                )}

                {formData.paymentMethod === 'momo' && (
                  <div className="payment-demo-box">
                    <p>
                      <strong>Quét mã QR MoMo để thanh toán demo</strong>
                    </p>
                    <img
                      src="/images/qr-momo.png"
                      alt="QR MoMo"
                      className="payment-qr"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <p>Ví MoMo: 0900000000</p>
                    <p>Chủ tài khoản: WIND FLOWER</p>
                    <p>Nội dung: MOMO {formData.phone || 'SODIENTHOAI'}</p>

                    <button
                      type="button"
                      className="demo-paid-btn"
                      onClick={() => setIsPaidDemo(true)}
                    >
                      Xác nhận mô phỏng MoMo - chưa xác minh
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="place-order-btn"
                disabled={submitting || checkingVoucher}
              >
                {submitting
                  ? 'Đang đặt hàng...'
                  : checkingVoucher
                    ? 'Đang kiểm tra voucher...'
                    : 'Xác nhận đặt hàng'}
              </button>
            </form>
          </div>

          <div className="checkout-summary-box">
            <h2>Đơn hàng của bạn</h2>
            <div className="checkout-delivery-summary">
              <p><strong>Người nhận:</strong> {formData.fullName || '—'}</p>
              <p><strong>Số điện thoại:</strong> {formData.phone || '—'}</p>
              <p><strong>Địa chỉ:</strong> {formData.address || '—'}</p>
              <p><strong>Ngày giao hoa:</strong> {formData.deliveryDate || '—'}</p>
              <p><strong>Khung giờ giao mong muốn:</strong> {formData.deliveryTimeSlot || '—'}</p>
              {formData.cardMessage.trim() && <p><strong>Lời nhắn thiệp:</strong> {formData.cardMessage.trim()}</p>}
              {formData.note.trim() && <p><strong>Ghi chú cho shop:</strong> {formData.note.trim()}</p>}
              <p><strong>Thanh toán:</strong> {{ cod: 'Thanh toán khi nhận hàng (COD)', bank: 'Chuyển khoản ngân hàng (demo)', momo: 'MoMo (demo)' }[formData.paymentMethod]}</p>
            </div>

            {cart.map((item) => {
              const finalPrice = Number(item.price || 0);
              const originalPrice = Number(item.originalPrice || item.price || 0);
              const quantity = Number(item.quantity || 0);
              const lineTotal = finalPrice * quantity;
              const hasDiscount = originalPrice > finalPrice;

              return (
                <div className="checkout-item" key={item._id}>
                  <img src={item.image} alt={item.name} />
                  <div className="checkout-item-info">
                    <h4>{item.name}</h4>
                    <p>Số lượng: {quantity}</p>

                    {hasDiscount ? (
                      <>
                        <p
                          style={{
                            margin: '0 0 4px',
                            textDecoration: 'line-through',
                            color: '#888'
                          }}
                        >
                          {formatMoney(originalPrice)} đ
                        </p>
                        <p
                          style={{
                            margin: '0 0 4px',
                            color: '#d81b60',
                            fontWeight: 700
                          }}
                        >
                          {formatMoney(finalPrice)} đ
                        </p>
                      </>
                    ) : (
                      <p>{formatMoney(finalPrice)} đ</p>
                    )}

                    <p>
                      Thành tiền: <strong>{formatMoney(lineTotal)} đ</strong>
                    </p>
                  </div>
                </div>
              );
            })}

            <div className="checkout-price-box">
              {voucherCode && (
                <p>
                  Mã voucher:
                  <strong> {voucherCode}</strong>
                </p>
              )}

              {voucherMessage && (
                <p style={{ color: discount > 0 ? 'green' : '#d81b60' }}>{voucherMessage}</p>
              )}

              {totalSavedOnProducts > 0 && (
                <p>
                  Tiết kiệm từ sản phẩm:
                  <strong> - {formatMoney(totalSavedOnProducts)} đ</strong>
                </p>
              )}

              <p>
                Tạm tính: <strong>{formatMoney(subtotal)} đ</strong>
              </p>
              <p>
                Giảm giá voucher: <strong>- {formatMoney(discount)} đ</strong>
              </p>
              <p>
                Phí vận chuyển:{' '}
                <strong>{shippingFee === 0 ? 'Miễn phí' : `${formatMoney(shippingFee)} đ`}</strong>
              </p>
              <hr />
              <p className="checkout-total">
                Tổng cộng: <strong>{formatMoney(finalTotal)} đ</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default CheckoutComponent;
