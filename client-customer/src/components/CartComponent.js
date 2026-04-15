import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../services/api';

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function getShippingFee(subtotal) {
  return Number(subtotal || 0) >= 1500000 ? 0 : 30000;
}

function CartComponent() {
  const [cart, setCart] = useState([]);
  const [voucherCode, setVoucherCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [voucherMessage, setVoucherMessage] = useState('');
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  const [availableVouchers, setAvailableVouchers] = useState([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [showVoucherList, setShowVoucherList] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('cart')) || [];
    setCart(data);

    const savedDiscount = Number(localStorage.getItem('cartDiscount')) || 0;
    const savedVoucher = localStorage.getItem('cartVoucherCode') || '';

    setDiscount(savedDiscount);
    setVoucherCode(savedVoucher);
  }, []);

  useEffect(() => {
    fetchAvailableVouchers();
  }, []);

  const fetchAvailableVouchers = async () => {
    try {
      setLoadingVouchers(true);

      const response = await API.get('/customer/vouchers/available');
      const data = response.data;

      if (!data.success) {
        setAvailableVouchers([]);
        return;
      }

      setAvailableVouchers(Array.isArray(data.vouchers) ? data.vouchers : []);
    } catch (err) {
      console.error('FETCH AVAILABLE VOUCHERS ERROR:', err);
      setAvailableVouchers([]);
    } finally {
      setLoadingVouchers(false);
    }
  };

  const getItemKey = (item) => item._id || item.id;

  const saveCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const clearVoucherStorage = () => {
    localStorage.removeItem('cartDiscount');
    localStorage.removeItem('cartVoucherCode');
    localStorage.removeItem('cartVoucherInfo');
  };

  const invalidateVoucherBecauseCartChanged = () => {
    if (discount > 0 || voucherCode.trim() !== '') {
      setDiscount(0);
      setVoucherMessage('Giỏ hàng đã thay đổi, vui lòng áp dụng lại voucher.');
      clearVoucherStorage();
    }
  };

  const updateQuantity = (productId, value) => {
    const newCart = [...cart];
    const index = newCart.findIndex((item) => getItemKey(item) === productId);

    if (index !== -1) {
      newCart[index].quantity = Number(newCart[index].quantity || 0) + value;

      if (newCart[index].quantity <= 0) {
        newCart.splice(index, 1);
      }

      saveCart(newCart);
      invalidateVoucherBecauseCartChanged();
    }
  };

  const removeItem = (productId) => {
    const newCart = cart.filter((item) => getItemKey(item) !== productId);
    saveCart(newCart);
    invalidateVoucherBecauseCartChanged();
  };

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

  const applyVoucher = async (manualCode) => {
    const code = String(manualCode || voucherCode || '').trim().toUpperCase();

    if (cart.length === 0) {
      setDiscount(0);
      setVoucherMessage('Giỏ hàng đang trống.');
      clearVoucherStorage();
      return;
    }

    if (!code) {
      setDiscount(0);
      setVoucherMessage('Vui lòng nhập mã giảm giá.');
      clearVoucherStorage();
      return;
    }

    try {
      setApplyingVoucher(true);
      setVoucherMessage('');

      const payload = {
        voucherCode: code,
        items: cart.map((item) => ({
          _id: getItemKey(item),
          quantity: Number(item.quantity || 0)
        }))
      };

      const response = await API.post('/customer/voucher/apply', payload);
      const data = response.data;

      if (!data.success) {
        setDiscount(0);
        setVoucherMessage(data.message || 'Áp dụng voucher thất bại.');
        clearVoucherStorage();
        return;
      }

      const newDiscount = Number(data.discount || 0);

      setDiscount(newDiscount);
      setVoucherCode(data.voucherCode || code);
      setVoucherMessage(data.message || 'Áp dụng voucher thành công.');

      localStorage.setItem('cartDiscount', String(newDiscount));
      localStorage.setItem('cartVoucherCode', data.voucherCode || code);
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
    } catch (err) {
      console.error('APPLY VOUCHER ERROR:', err);
      setDiscount(0);
      setVoucherMessage(
        err?.response?.data?.message || 'Không thể kết nối tới máy chủ để áp dụng voucher.'
      );
      clearVoucherStorage();
    } finally {
      setApplyingVoucher(false);
    }
  };

  const copyVoucherCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setVoucherMessage(`Đã sao chép mã ${code}`);
      setVoucherCode(code);
    } catch (err) {
      console.error('COPY VOUCHER ERROR:', err);
      setVoucherMessage(`Không thể sao chép tự động. Mã của bạn là: ${code}`);
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Giỏ hàng đang trống.');
      return;
    }

    const customer = localStorage.getItem('customer');
    const token = localStorage.getItem('customerToken');

    if (!customer || !token) {
      alert('Vui lòng đăng nhập để tiếp tục mua hàng.');
      navigate('/login');
      return;
    }

    navigate('/checkout');
  };

  return (
    <div className="container cart-page">
      <div className="cart-top">
        <h1>Giỏ hàng</h1>
        <Link to="/" className="back-home-btn">
          ← Quay về trang chủ
        </Link>
      </div>

      {cart.length === 0 ? (
        <div>
          <p>Giỏ hàng đang trống.</p>
          <Link to="/" className="back-home-btn">
            Quay về trang chủ
          </Link>
        </div>
      ) : (
        <>
          {cart.map((item) => {
            const productId = getItemKey(item);
            const finalPrice = Number(item.price || 0);
            const originalPrice = Number(item.originalPrice || item.price || 0);
            const quantity = Number(item.quantity || 0);
            const lineTotal = finalPrice * quantity;
            const hasDiscount = originalPrice > finalPrice;

            return (
              <div className="cart-item" key={productId}>
                <img src={item.image} alt={item.name} />
                <div className="cart-info">
                  <h3>{item.name}</h3>

                  {hasDiscount ? (
                    <div>
                      <p
                        style={{
                          margin: '0 0 4px',
                          textDecoration: 'line-through',
                          color: '#888'
                        }}
                      >
                        {formatMoney(originalPrice)} đ
                      </p>
                      <p style={{ margin: '0 0 6px', color: '#d81b60', fontWeight: 700 }}>
                        {formatMoney(finalPrice)} đ
                      </p>
                    </div>
                  ) : (
                    <p>{formatMoney(finalPrice)} đ</p>
                  )}

                  <div className="cart-qty">
                    <button onClick={() => updateQuantity(productId, -1)}>-</button>
                    <span>{quantity}</span>
                    <button onClick={() => updateQuantity(productId, 1)}>+</button>
                  </div>

                  <p style={{ marginTop: '8px', fontWeight: 600 }}>
                    Thành tiền: {formatMoney(lineTotal)} đ
                  </p>

                  <button className="remove-btn" onClick={() => removeItem(productId)}>
                    Xóa
                  </button>
                </div>
              </div>
            );
          })}

          <div className="voucher-box">
            <h3>Mã giảm giá</h3>
            <div className="voucher-row">
              <input
                type="text"
                placeholder="Nhập voucher của bạn"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              />
              <button onClick={() => applyVoucher()} disabled={applyingVoucher}>
                {applyingVoucher ? 'Đang áp dụng...' : 'Áp dụng'}
              </button>
            </div>
            {voucherMessage && <p className="voucher-message">{voucherMessage}</p>}
          </div>

          <div className="voucher-box" style={{ marginTop: '18px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <h3 style={{ margin: 0 }}>Mã voucher</h3>
              <button
                type="button"
                onClick={() => setShowVoucherList((prev) => !prev)}
                style={{
                  background: '#d81b60',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {showVoucherList ? 'Ẩn mã voucher' : 'Xem mã voucher'}
              </button>
            </div>

            {showVoucherList && (
              <div
                style={{
                  marginTop: '14px',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  paddingRight: '4px'
                }}
              >
                {loadingVouchers ? (
                  <p>Đang tải danh sách voucher...</p>
                ) : availableVouchers.length === 0 ? (
                  <p>Hiện chưa có voucher khả dụng.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {availableVouchers.map((voucher) => (
                      <div
                        key={voucher._id || voucher.code}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px 14px',
                          border: '1px solid #f3bfd0',
                          borderRadius: '10px',
                          background: '#fff'
                        }}
                      >
                        <strong style={{ color: '#d81b60', fontSize: '16px' }}>
                          {voucher.code}
                        </strong>

                        <button
                          type="button"
                          onClick={() => copyVoucherCode(voucher.code)}
                          style={{
                            background: '#f5f5f5',
                            color: '#333',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Sao chép mã
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="cart-summary">
            {totalSavedOnProducts > 0 && (
              <p>
                Tiết kiệm từ sản phẩm:
                <strong> - {formatMoney(totalSavedOnProducts)} đ</strong>
              </p>
            )}

            <p>
              Tạm tính:
              <strong> {formatMoney(subtotal)} đ</strong>
            </p>

            <p>
              Giảm giá voucher:
              <strong> - {formatMoney(discount)} đ</strong>
            </p>

            <p>
              Phí vận chuyển:
              <strong>
                {' '}
                {shippingFee === 0 ? 'Miễn phí' : `${formatMoney(shippingFee)} đ`}
              </strong>
            </p>

            <h2>Tổng thanh toán: {formatMoney(finalTotal)} đ</h2>

            <button className="checkout-btn" onClick={handleCheckout}>
              Mua hàng
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default CartComponent;