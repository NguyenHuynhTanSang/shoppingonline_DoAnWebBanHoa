import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  Link,
  useNavigate
} from 'react-router-dom';

import API from '../services/api';

import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function formatMoney(value) {
  return Number(
    value || 0
  ).toLocaleString('vi-VN');
}

function getShippingFee(subtotal) {
  return Number(
    subtotal || 0
  ) >= 1500000
    ? 0
    : 30000;
}

function CartComponent() {
  const [
    cart,
    setCart
  ] = useState([]);

  const cartRef = useRef(cart);
  cartRef.current = cart;
  const stockChecks = useRef(new Set());

  const [
    voucherCode,
    setVoucherCode
  ] = useState('');

  const [
    discount,
    setDiscount
  ] = useState(0);

  const [
    voucherMessage,
    setVoucherMessage
  ] = useState('');

  const [
    applyingVoucher,
    setApplyingVoucher
  ] = useState(false);

  const [
    availableVouchers,
    setAvailableVouchers
  ] = useState([]);

  const [
    loadingVouchers,
    setLoadingVouchers
  ] = useState(false);

  const [
    showVoucherList,
    setShowVoucherList
  ] = useState(false);

  const navigate =
    useNavigate();

  useEffect(() => {
    try {
      const rawCart =
        localStorage.getItem(
          'cart'
        );

      const parsedCart =
        rawCart
          ? JSON.parse(rawCart)
          : [];

      setCart(
        Array.isArray(
          parsedCart
        )
          ? parsedCart
          : []
      );
    } catch (error) {
      console.error(
        'READ CART ERROR:',
        error
      );

      setCart([]);

      localStorage.removeItem(
        'cart'
      );
    }

    const savedDiscount =
      Number(
        localStorage.getItem(
          'cartDiscount'
        )
      ) || 0;

    const savedVoucher =
      localStorage.getItem(
        'cartVoucherCode'
      ) || '';

    setDiscount(
      savedDiscount
    );

    setVoucherCode(
      savedVoucher
    );
  }, []);

  useEffect(() => {
    const fetchAvailableVouchers =
      async () => {
        try {
          setLoadingVouchers(
            true
          );

          const response =
            await API.get(
              '/customer/vouchers/available'
            );

          const data =
            response.data;

          if (!data.success) {
            setAvailableVouchers(
              []
            );

            return;
          }

          setAvailableVouchers(
            Array.isArray(
              data.vouchers
            )
              ? data.vouchers
              : []
          );
        } catch (error) {
          console.error(
            'FETCH AVAILABLE VOUCHERS ERROR:',
            error
          );

          setAvailableVouchers(
            []
          );
        } finally {
          setLoadingVouchers(
            false
          );
        }
      };

    fetchAvailableVouchers();
  }, []);

  const getItemKey =
    item =>
      item._id ||
      item.id;

  const saveCart =
    newCart => {
      cartRef.current = newCart;
      setCart(
        newCart
      );

      localStorage.setItem(
        'cart',
        JSON.stringify(
          newCart
        )
      );
      window.dispatchEvent(new CustomEvent('cartUpdated'));
    };

  const clearVoucherStorage =
    () => {
      localStorage.removeItem(
        'cartDiscount'
      );

      localStorage.removeItem(
        'cartVoucherCode'
      );

      localStorage.removeItem(
        'cartVoucherInfo'
      );
    };

  const invalidateVoucherBecauseCartChanged =
    () => {
      if (
        discount > 0 ||
        voucherCode.trim() !== ''
      ) {
        setDiscount(0);

        setVoucherMessage(
          'Giỏ hàng đã thay đổi, vui lòng áp dụng lại voucher.'
        );

        clearVoucherStorage();
      }
    };

  const updateQuantity = async (
    productId,
    value
  ) => {
    let availableStock;
    if (value > 0) {
      if (stockChecks.current.has(productId)) return;
      stockChecks.current.add(productId);
      try {
        const response = await API.get(
          `/customer/products/${encodeURIComponent(productId)}`,
          { timeout: 10000 }
        );
        const product = response.data;
        if (
          String(product?._id) !== String(productId) ||
          typeof product?.stock !== 'number' ||
          !Number.isFinite(product.stock) || product.stock < 0
        ) {
          throw new Error('Invalid stock response');
        }
        availableStock = product.stock;
      } catch (error) {
        alert('Chưa thể kiểm tra tồn kho. Vui lòng thử lại sau.');
        return;
      } finally {
        stockChecks.current.delete(productId);
      }
    }

    const newCart =
      cartRef.current.map(item => ({
        ...item
      }));

    const index =
      newCart.findIndex(
        item =>
          getItemKey(item) ===
          productId
      );

    if (index === -1) {
      return;
    }

    const currentQuantity =
      Number(
        newCart[index]
          .quantity || 0
      );

    const nextQuantity =
      currentQuantity +
      value;

    if (value > 0 && nextQuantity > availableStock) {
      alert(
        availableStock === 0
          ? 'Sản phẩm hiện đã hết hàng.'
          : `Sản phẩm chỉ còn ${availableStock} sản phẩm trong kho.`
      );
      return;
    }

    if (
      nextQuantity <= 0
    ) {
      newCart.splice(
        index,
        1
      );
    } else {
      newCart[index].quantity =
        nextQuantity;
    }

    saveCart(
      newCart
    );

    invalidateVoucherBecauseCartChanged();
  };

  const removeItem =
    productId => {
      const newCart =
        cart.filter(
          item =>
            getItemKey(
              item
            ) !==
            productId
        );

      saveCart(
        newCart
      );

      invalidateVoucherBecauseCartChanged();
    };

  const subtotal =
    useMemo(() => {
      return cart.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.price || 0
          ) *
          Number(
            item.quantity ||
            0
          ),
        0
      );
    }, [cart]);

  const totalSavedOnProducts =
    useMemo(() => {
      return cart.reduce(
        (
          sum,
          item
        ) => {
          const originalPrice =
            Number(
              item.originalPrice ||
              item.price ||
              0
            );

          const finalPrice =
            Number(
              item.price || 0
            );

          const quantity =
            Number(
              item.quantity ||
              0
            );

          if (
            originalPrice >
            finalPrice
          ) {
            return (
              sum +
              (
                originalPrice -
                finalPrice
              ) *
              quantity
            );
          }

          return sum;
        },
        0
      );
    }, [cart]);

  const totalItems =
    useMemo(() => {
      return cart.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.quantity ||
            0
          ),
        0
      );
    }, [cart]);

  const shippingFee =
    useMemo(
      () =>
        getShippingFee(
          subtotal
        ),
      [subtotal]
    );

  const freeShippingRemaining =
    Math.max(
      1500000 -
      subtotal,
      0
    );

  const finalTotal =
    Math.max(
      subtotal -
      discount +
      shippingFee,
      0
    );

  const applyVoucher =
    async manualCode => {
      const code =
        String(
          manualCode ||
          voucherCode ||
          ''
        )
          .trim()
          .toUpperCase();

      if (
        cart.length === 0
      ) {
        setDiscount(0);

        setVoucherMessage(
          'Giỏ hàng đang trống.'
        );

        clearVoucherStorage();

        return;
      }

      if (!code) {
        setDiscount(0);

        setVoucherMessage(
          'Vui lòng nhập mã giảm giá.'
        );

        clearVoucherStorage();

        return;
      }

      try {
        setApplyingVoucher(
          true
        );

        setVoucherMessage(
          ''
        );

        const payload = {
          voucherCode:
            code,

          items:
            cart.map(
              item => ({
                _id:
                  getItemKey(
                    item
                  ),

                quantity:
                  Number(
                    item.quantity ||
                    0
                  )
              })
            )
        };

        const response =
          await API.post(
            '/customer/voucher/apply',
            payload
          );

        const data =
          response.data;

        if (!data.success) {
          setDiscount(0);

          setVoucherMessage(
            data.message ||
            'Áp dụng voucher thất bại.'
          );

          clearVoucherStorage();

          return;
        }

        const newDiscount =
          Number(
            data.discount ||
            0
          );

        const appliedCode =
          data.voucherCode ||
          code;

        setDiscount(
          newDiscount
        );

        setVoucherCode(
          appliedCode
        );

        setVoucherMessage(
          data.message ||
          'Áp dụng voucher thành công.'
        );

        localStorage.setItem(
          'cartDiscount',
          String(
            newDiscount
          )
        );

        localStorage.setItem(
          'cartVoucherCode',
          appliedCode
        );

        localStorage.setItem(
          'cartVoucherInfo',
          JSON.stringify({
            voucher:
              data.voucher ||
              null,

            subtotal:
              Number(
                data.subtotal ||
                0
              ),

            discount:
              newDiscount,

            shippingFee:
              Number(
                data.shippingFee ||
                0
              ),

            total:
              Number(
                data.total ||
                0
              )
          })
        );
      } catch (error) {
        console.error(
          'APPLY VOUCHER ERROR:',
          error
        );

        setDiscount(0);

        setVoucherMessage(
          error?.response
            ?.data?.message ||
          'Không thể kết nối tới máy chủ để áp dụng voucher.'
        );

        clearVoucherStorage();
      } finally {
        setApplyingVoucher(
          false
        );
      }
    };

  const handleVoucherSubmit =
    event => {
      event.preventDefault();

      applyVoucher();
    };

  const copyVoucherCode =
    async code => {
      try {
        if (
          !navigator.clipboard
        ) {
          throw new Error(
            'Clipboard API unavailable'
          );
        }

        await navigator.clipboard.writeText(
          code
        );

        setVoucherMessage(
          `Đã sao chép mã ${code}`
        );

        setVoucherCode(
          code
        );
      } catch (error) {
        console.error(
          'COPY VOUCHER ERROR:',
          error
        );

        setVoucherCode(
          code
        );

        setVoucherMessage(
          `Không thể sao chép tự động. Mã của bạn là: ${code}`
        );
      }
    };

  const handleCheckout =
    () => {
      if (
        cart.length === 0
      ) {
        alert(
          'Giỏ hàng đang trống.'
        );

        return;
      }

      const customer =
        localStorage.getItem(
          'customer'
        );

      const token =
        localStorage.getItem(
          'customerToken'
        );

      if (
        !customer ||
        !token
      ) {
        alert(
          'Vui lòng đăng nhập để tiếp tục mua hàng.'
        );

        navigate(
          '/login'
        );

        return;
      }

      navigate(
        '/checkout'
      );
    };

  return (
    <div className="wf-cart-page-shell">
      <MenuComponent />

      <main className="container wf-cart-page">
        <header className="wf-cart-header">
          <div>
            <span className="wf-cart-eyebrow">
              WIND FLOWER
            </span>

            <h1>
              Giỏ hàng
            </h1>

            {cart.length > 0 && (
              <p>
                Bạn đang có{' '}
                <strong>
                  {totalItems}
                </strong>{' '}
                sản phẩm trong giỏ.
              </p>
            )}
          </div>

          <Link
            to="/"
            className="wf-cart-back-button"
          >
            ← Tiếp tục mua hoa
          </Link>
        </header>

        {cart.length === 0 ? (
          <section className="wf-cart-empty">
            <div className="wf-cart-empty-icon">
              🛒
            </div>

            <h2>
              Giỏ hàng đang trống
            </h2>

            <p>
              Bạn chưa thêm sản phẩm nào.
              Hãy khám phá các mẫu hoa
              của Wind Flower nhé.
            </p>

            <Link
              to="/"
              className="wf-cart-empty-button"
            >
              Khám phá sản phẩm
            </Link>
          </section>
        ) : (
          <div className="wf-cart-layout">
            <section className="wf-cart-main">
              <div className="wf-cart-panel">
                <div className="wf-cart-panel-heading">
                  <div>
                    <span>
                      SẢN PHẨM
                    </span>

                    <h2>
                      Sản phẩm đã chọn
                    </h2>
                  </div>

                  <strong>
                    {totalItems}{' '}
                    sản phẩm
                  </strong>
                </div>

                <div className="wf-cart-items">
                  {cart.map(
                    item => {
                      const productId =
                        getItemKey(
                          item
                        );

                      const finalPrice =
                        Number(
                          item.price ||
                          0
                        );

                      const originalPrice =
                        Number(
                          item.originalPrice ||
                          item.price ||
                          0
                        );

                      const quantity =
                        Number(
                          item.quantity ||
                          0
                        );

                      const lineTotal =
                        finalPrice *
                        quantity;

                      const hasDiscount =
                        originalPrice >
                        finalPrice;

                      return (
                        <article
                          className="wf-cart-item"
                          key={
                            productId
                          }
                        >
                          <Link
                            to={`/product/${productId}`}
                            className="wf-cart-item-image-link"
                          >
                            <img
                              className="wf-cart-item-image"
                              src={
                                item.image
                              }
                              alt={
                                item.name
                              }
                              loading="lazy"
                              onError={
                                event => {
                                  event.currentTarget.src =
                                    'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=500&q=80';
                                }
                              }
                            />
                          </Link>

                          <div className="wf-cart-item-content">
                            <div className="wf-cart-item-top">
                              <div>
                                <Link
                                  to={`/product/${productId}`}
                                  className="wf-cart-item-name"
                                >
                                  {
                                    item.name
                                  }
                                </Link>

                                {hasDiscount ? (
                                  <div className="wf-cart-item-price">
                                    <span className="wf-cart-item-original-price">
                                      {formatMoney(
                                        originalPrice
                                      )}{' '}
                                      đ
                                    </span>

                                    <strong>
                                      {formatMoney(
                                        finalPrice
                                      )}{' '}
                                      đ
                                    </strong>
                                  </div>
                                ) : (
                                  <div className="wf-cart-item-price">
                                    <strong>
                                      {formatMoney(
                                        finalPrice
                                      )}{' '}
                                      đ
                                    </strong>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                className="wf-cart-remove-button"
                                onClick={() =>
                                  removeItem(
                                    productId
                                  )
                                }
                              >
                                Xóa
                              </button>
                            </div>

                            <div className="wf-cart-item-bottom">
                              <div className="wf-cart-quantity">
                                <span className="wf-cart-quantity-label">
                                  Số lượng
                                </span>

                                <div className="wf-cart-quantity-control">
                                  <button
                                    type="button"
                                    aria-label={`Giảm số lượng ${item.name}`}
                                    onClick={() =>
                                      updateQuantity(
                                        productId,
                                        -1
                                      )
                                    }
                                  >
                                    −
                                  </button>

                                  <span>
                                    {
                                      quantity
                                    }
                                  </span>

                                  <button
                                    type="button"
                                    aria-label={`Tăng số lượng ${item.name}`}
                                    onClick={() =>
                                      updateQuantity(
                                        productId,
                                        1
                                      )
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <div className="wf-cart-line-total">
                                <span>
                                  Thành tiền
                                </span>

                                <strong>
                                  {formatMoney(
                                    lineTotal
                                  )}{' '}
                                  đ
                                </strong>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              </div>

              <section className="wf-cart-panel wf-cart-voucher-panel">
                <div className="wf-cart-panel-heading">
                  <div>
                    <span>
                      ƯU ĐÃI
                    </span>

                    <h2>
                      Mã giảm giá
                    </h2>
                  </div>
                </div>

                <form
                  className="wf-cart-voucher-form"
                  onSubmit={
                    handleVoucherSubmit
                  }
                >
                  <input
                    type="text"
                    placeholder="Nhập mã voucher"
                    value={
                      voucherCode
                    }
                    onChange={
                      event =>
                        setVoucherCode(
                          event.target.value.toUpperCase()
                        )
                    }
                    aria-label="Mã voucher"
                  />

                  <button
                    type="submit"
                    disabled={
                      applyingVoucher
                    }
                  >
                    {applyingVoucher
                      ? 'Đang áp dụng...'
                      : 'Áp dụng'}
                  </button>
                </form>

                {voucherMessage && (
                  <p
                    className="wf-cart-voucher-message"
                    aria-live="polite"
                  >
                    {
                      voucherMessage
                    }
                  </p>
                )}

                <div className="wf-cart-voucher-library">
                  <button
                    type="button"
                    className="wf-cart-voucher-toggle"
                    aria-expanded={
                      showVoucherList
                    }
                    onClick={() =>
                      setShowVoucherList(
                        previous =>
                          !previous
                      )
                    }
                  >
                    <span>
                      Mã voucher khả dụng
                    </span>

                    <span>
                      {showVoucherList
                        ? '▲'
                        : '▼'}
                    </span>
                  </button>

                  {showVoucherList && (
                    <div className="wf-cart-voucher-list">
                      {loadingVouchers ? (
                        <p className="wf-cart-voucher-status">
                          Đang tải danh sách voucher...
                        </p>
                      ) : availableVouchers.length ===
                        0 ? (
                        <p className="wf-cart-voucher-status">
                          Hiện chưa có voucher khả dụng.
                        </p>
                      ) : (
                        availableVouchers.map(
                          voucher => (
                            <div
                              key={
                                voucher._id ||
                                voucher.code
                              }
                              className="wf-cart-voucher-item"
                            >
                              <div>
                                <span>
                                  Mã giảm giá
                                </span>

                                <strong>
                                  {
                                    voucher.code
                                  }
                                </strong>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  copyVoucherCode(
                                    voucher.code
                                  )
                                }
                              >
                                Dùng mã
                              </button>
                            </div>
                          )
                        )
                      )}
                    </div>
                  )}
                </div>
              </section>
            </section>

            <aside className="wf-cart-summary">
              <div className="wf-cart-summary-card">
                <span className="wf-cart-summary-eyebrow">
                  ĐƠN HÀNG
                </span>

                <h2>
                  Tóm tắt thanh toán
                </h2>

                <div className="wf-cart-summary-lines">
                  {totalSavedOnProducts >
                    0 && (
                    <div className="wf-cart-summary-line wf-cart-saving-line">
                      <span>
                        Tiết kiệm từ sản phẩm
                      </span>

                      <strong>
                        -{' '}
                        {formatMoney(
                          totalSavedOnProducts
                        )}{' '}
                        đ
                      </strong>
                    </div>
                  )}

                  <div className="wf-cart-summary-line">
                    <span>
                      Tạm tính
                    </span>

                    <strong>
                      {formatMoney(
                        subtotal
                      )}{' '}
                      đ
                    </strong>
                  </div>

                  <div className="wf-cart-summary-line">
                    <span>
                      Voucher
                    </span>

                    <strong>
                      -{' '}
                      {formatMoney(
                        discount
                      )}{' '}
                      đ
                    </strong>
                  </div>

                  <div className="wf-cart-summary-line">
                    <span>
                      Phí vận chuyển
                    </span>

                    <strong>
                      {shippingFee ===
                      0
                        ? 'Miễn phí'
                        : `${formatMoney(
                            shippingFee
                          )} đ`}
                    </strong>
                  </div>
                </div>

                <div className="wf-cart-shipping-note">
                  {shippingFee ===
                  0 ? (
                    <>
                      <strong>
                        ✓ Bạn được miễn phí giao hàng
                      </strong>

                      <span>
                        Áp dụng vì tạm tính sản phẩm
                        trước voucher đạt từ
                        1.500.000 đ.
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>
                        Miễn phí giao hàng từ
                        1.500.000 đ
                      </strong>

                      <span>
                        Mua thêm{' '}
                        {formatMoney(
                          freeShippingRemaining
                        )}{' '}
                        đ để được miễn phí giao hàng.
                      </span>
                    </>
                  )}
                </div>

                <div className="wf-cart-total">
                  <span>
                    Tổng thanh toán
                  </span>

                  <strong>
                    {formatMoney(
                      finalTotal
                    )}{' '}
                    đ
                  </strong>
                </div>

                <button
                  type="button"
                  className="wf-cart-checkout-button"
                  onClick={
                    handleCheckout
                  }
                >
                  Tiến hành thanh toán
                </button>

                <p className="wf-cart-summary-help">
                  Phí giao hàng và voucher sẽ
                  được kiểm tra lại tại bước
                  thanh toán.
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>

      <InformComponent />
    </div>
  );
}

export default CartComponent;