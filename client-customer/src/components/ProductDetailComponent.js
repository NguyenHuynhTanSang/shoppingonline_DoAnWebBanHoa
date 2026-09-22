import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

import API from '../services/api';
import getImageSrc from '../services/productImage';

import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function getCategoryName(product) {
  if (!product) return '';

  if (typeof product.category === 'string') {
    return product.category;
  }

  return product.category?.name || '';
}

function getCategoryPath(product) {
  const categoryName = normalizeText(
    getCategoryName(product)
  );

  const categorySlug = normalizeText(
    product?.category?.slug ||
    product?.categorySlug ||
    ''
  );

  if (categorySlug) {
    return `/category/${categorySlug}`;
  }

  const map = {
    'bó hoa 8-3': '/category/bo-hoa-8-3',
    'bó hoa': '/category/bo-hoa-8-3',

    'giỏ hoa 8-3': '/category/gio-hoa-8-3',
    'giỏ hoa': '/category/gio-hoa-8-3',

    'bình hoa 8-3': '/category/binh-hoa-8-3',
    'bình hoa': '/category/binh-hoa-8-3',

    'hoa tulip': '/category/tulip',
    tulip: '/category/tulip',

    'hoa hồng': '/category/hoa-hong',

    'hoa hướng dương':
      '/category/hoa-huong-duong',

    'hoa cát tường':
      '/category/hoa-cat-tuong',

    'hoa lan hồ điệp':
      '/category/hoa-lan-ho-diep'
  };

  return map[categoryName] || '/';
}

function getDiscountInfo(product) {
  const originalPrice = Number(
    product?.price || 0
  );

  const discountPercent = Math.max(
    0,
    Math.min(
      100,
      Number(
        product?.discountPercent || 0
      )
    )
  );

  const discountPrice = Math.max(
    0,
    Number(
      product?.discountPrice || 0
    )
  );

  let finalPrice = originalPrice;
  let discountLabel = '';

  if (
    discountPrice > 0 &&
    discountPrice < originalPrice
  ) {
    const priceAfterFixedDiscount =
      originalPrice - discountPrice;

    if (
      priceAfterFixedDiscount <
      finalPrice
    ) {
      finalPrice =
        priceAfterFixedDiscount;

      discountLabel =
        `Giảm ${formatMoney(discountPrice)} đ`;
    }
  }

  if (discountPercent > 0) {
    const priceAfterPercent =
      Math.round(
        originalPrice *
        (
          100 -
          discountPercent
        ) /
        100
      );

    if (
      priceAfterPercent <
      finalPrice
    ) {
      finalPrice =
        priceAfterPercent;

      discountLabel =
        `Giảm ${discountPercent}%`;
    }
  }

  finalPrice = Math.max(
    0,
    finalPrice
  );

  return {
    originalPrice,
    finalPrice,

    hasDiscount:
      finalPrice <
      originalPrice,

    savedAmount:
      Math.max(
        0,
        originalPrice -
        finalPrice
      ),

    discountLabel
  };
}

function renderStars(rating) {
  const safeRating = Math.max(
    0,
    Math.min(
      5,
      Number(rating || 0)
    )
  );

  return (
    '★'.repeat(safeRating) +
    '☆'.repeat(
      5 - safeRating
    )
  );
}

function formatReviewDate(value) {
  const time =
    Number(value || 0);

  if (!time) {
    return 'Chưa có ngày';
  }

  return new Date(
    time
  ).toLocaleString('vi-VN');
}

function ProductDetailComponent() {
  const [cartFeedback, setCartFeedback] = useState(0);

  useEffect(() => {
    if (!cartFeedback) return;
    const timeout = setTimeout(() => setCartFeedback(0), 3000);
    return () => clearTimeout(timeout);
  }, [cartFeedback]);

  const { id } =
    useParams();

  const navigate =
    useNavigate();

  const [
    activeTab,
    setActiveTab
  ] = useState('shipping');

  const [
    product,
    setProduct
  ] = useState(null);

  const [
    allProducts,
    setAllProducts
  ] = useState([]);

  const [
    reviews,
    setReviews
  ] = useState([]);

  const [
    reviewSummary,
    setReviewSummary
  ] = useState({
    reviewCount: 0,
    averageRating: 0
  });

  const [
    loading,
    setLoading
  ] = useState(true);
  const [
  loadError,
  setLoadError
  ] = useState('');

  const [
  reloadKey,
  setReloadKey
  ] = useState(0);

  const [
    reviewsLoading,
    setReviewsLoading
  ] = useState(true);

  const [reviewLoadError, setReviewLoadError] = useState('');

  useEffect(() => {
    window.scrollTo(
      0,
      0
    );
  }, [id]);

  useEffect(() => {
  let isActive = true;
  const fetchData = async () => {
    try {
      setLoading(true);
      setReviewsLoading(true);
      setLoadError('');
      setReviewLoadError('');
      setAllProducts([]);
      setReviews([]);
      setReviewSummary({ reviewCount: 0, averageRating: 0 });

      // Product là dữ liệu chính.
      const productRes = await API.get(
        `/customer/products/${id}`
      );
      if (!isActive) return;

      const productData =
        productRes.data &&
        productRes.data._id
          ? productRes.data
          : null;

      if (!productData) {
        setReviewsLoading(false);
        setProduct(null);
        setAllProducts([]);
        setReviews([]);
        setReviewSummary({
          reviewCount: 0,
          averageRating: 0
        });

        return;
      }

      setProduct(productData);
      setLoading(false);

      // Sản phẩm liên quan là dữ liệu phụ:
      // lỗi phần này không được làm chết Product Detail.
      const fetchRelated = async () => {
      try {
        const allProductsRes = await API.get(
          '/customer/all-products'
        );
        if (!isActive) return;

        setAllProducts(
          Array.isArray(allProductsRes.data)
            ? allProductsRes.data
            : []
        );
      } catch (relatedError) {
        if (!isActive) return;
        console.error(
          'RELATED PRODUCTS LOAD ERROR:',
          relatedError
        );

        setAllProducts([]);
      }
      };

      // Review cũng là dữ liệu phụ.
      const fetchReviews = async () => {
      try {
        const reviewsRes = await API.get(
          `/customer/reviews/product/${id}`
        );
        if (!isActive) return;
        if (reviewsRes.data?.success === false) {
          throw new Error('Review request failed');
        }

        const reviewData =
          Array.isArray(
            reviewsRes?.data?.reviews
          )
            ? reviewsRes.data.reviews
            : [];

        const summaryData =
          reviewsRes?.data?.summary || {
            reviewCount: 0,
            averageRating: 0
          };

        setReviews(reviewData);

        setReviewSummary({
          reviewCount: Number(
            summaryData.reviewCount || 0
          ),
          averageRating: Number(
            summaryData.averageRating || 0
          )
        });
      } catch (reviewError) {
        if (!isActive) return;
        console.error(
          'REVIEW LOAD ERROR:',
          reviewError
        );

        setReviews([]);
        setReviewLoadError('Không thể tải đánh giá. Vui lòng thử lại sau.');

        setReviewSummary({
          reviewCount: 0,
          averageRating: 0
        });
      } finally {
        if (isActive) setReviewsLoading(false);
      }
      };
      fetchRelated();
      fetchReviews();
    } catch (error) {
      if (!isActive) return;
      console.error(
        'Lỗi load chi tiết sản phẩm:',
        error
      );

      setProduct(null);
      setAllProducts([]);
      setReviews([]);
      setReviewsLoading(false);

      setReviewSummary({
        reviewCount: 0,
        averageRating: 0
      });

      if (error.response?.status !== 404) {
        setLoadError(
          'Không thể tải sản phẩm. Vui lòng thử lại.'
        );
      }
    } finally {
      if (isActive) setLoading(false);
    }
  };

  fetchData();
  return () => { isActive = false; };
}, [id, reloadKey]);

  const discountInfo =
    useMemo(
      () =>
        getDiscountInfo(
          product
        ),
      [product]
    );

  const currentStock =
    Number(
      product?.stock || 0
    );

  const isOutOfStock =
    product
      ? currentStock <= 0
      : false;

  const isLowStock =
    product
      ? currentStock > 0 &&
        currentStock <= 5
      : false;

  const stockText =
    useMemo(() => {
      if (!product) {
        return 'Đang tải dữ liệu kho...';
      }

      if (
        currentStock <= 0
      ) {
        return 'Hết hàng';
      }

      if (
        currentStock <= 5
      ) {
        return `Chỉ còn ${currentStock} sản phẩm`;
      }

      return `Còn ${currentStock} sản phẩm`;
    }, [
      product,
      currentStock
    ]);

  const stockClass =
    useMemo(() => {
      if (!product) {
        return 'product-stock-badge stock-unknown';
      }

      if (
        currentStock <= 0
      ) {
        return 'product-stock-badge stock-out';
      }

      if (
        currentStock <= 5
      ) {
        return 'product-stock-badge stock-low';
      }

      return 'product-stock-badge stock-in';
    }, [
      product,
      currentStock
    ]);

  const relatedProducts =
    useMemo(() => {
      if (!product) {
        return [];
      }

      const currentCategoryName =
        normalizeText(
          getCategoryName(
            product
          )
        );

      return allProducts
        .filter(item => {
          if (
            !item ||
            !item._id
          ) {
            return false;
          }

          if (
            String(
              item._id
            ) ===
            String(
              product._id
            )
          ) {
            return false;
          }

          const itemCategoryName =
            normalizeText(
              getCategoryName(
                item
              )
            );

          return (
            itemCategoryName ===
            currentCategoryName
          );
        })
        .slice(0, 4);
    }, [
      allProducts,
      product
    ]);

  const addToCart = (
    currentProduct,
    showAlert = true
  ) => {
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
        'Vui lòng đăng nhập để mua hàng.'
      );

      navigate('/login');

      return false;
    }

    if (
      !currentProduct ||
      !currentProduct._id
    ) {
      alert(
        'Không tìm thấy sản phẩm trong MongoDB.'
      );

      return false;
    }

    const stock =
      Number(
        currentProduct.stock ||
        0
      );

    if (stock <= 0) {
      alert(
        'Sản phẩm hiện đã hết hàng.'
      );

      return false;
    }

    const discount =
      getDiscountInfo(
        currentProduct
      );

    let cart = [];

    try {
      cart =
        JSON.parse(
          localStorage.getItem(
            'cart'
          )
        ) || [];
    } catch (error) {
      console.error(
        'READ CART ERROR:',
        error
      );

      cart = [];
    }

    const index =
      cart.findIndex(
        item =>
          item._id ===
          currentProduct._id
      );

    if (index !== -1) {
      const nextQty =
        Number(
          cart[index]
            .quantity || 0
        ) + 1;

      if (
        nextQty > stock
      ) {
        alert(
          `Sản phẩm "${currentProduct.name}" chỉ còn ${stock} trong kho`
        );

        return false;
      }

      cart[index].quantity =
        nextQty;

      cart[index].price =
        Number(
          discount.finalPrice ||
          0
        );

      cart[index].originalPrice =
        Number(
          discount.originalPrice ||
          0
        );

      cart[index].discountPercent =
        Number(
          currentProduct.discountPercent ||
          0
        );

      cart[index].discountPrice =
        Number(
          currentProduct.discountPrice ||
          0
        );
    } else {
      cart.push({
        _id:
          currentProduct._id,

        name:
          currentProduct.name,

        image:
          getImageSrc(
            currentProduct.image
          ),

        price:
          Number(
            discount.finalPrice ||
            0
          ),

        originalPrice:
          Number(
            discount.originalPrice ||
            0
          ),

        discountPercent:
          Number(
            currentProduct.discountPercent ||
            0
          ),

        discountPrice:
          Number(
            currentProduct.discountPrice ||
            0
          ),

        quantity: 1
      });
    }

    localStorage.setItem(
      'cart',
      JSON.stringify(
        cart
      )
    );

    window.dispatchEvent(new CustomEvent('cartUpdated'));

    if (showAlert) {
      setCartFeedback(value => value + 1);
    }

    return true;
  };

  const handleBuyNow =
    currentProduct => {
      const ok =
        addToCart(
          currentProduct,
          false
        );

      if (ok) {
        navigate(
          '/cart'
        );
      }
    };

  if (loading) {
    return (
      <div>
        <MenuComponent />

        <main className="container product-detail-page">
          <div className="product-detail-state">
            <h2>
              Đang tải sản phẩm...
            </h2>
          </div>
        </main>

        <InformComponent />
      </div>
    );
  }
  if (loadError) {
    return (
      <div>
        <MenuComponent />

        <main className="container product-detail-page">
          <div className="product-detail-state">
            <h2>Không thể tải sản phẩm</h2>

            <p>{loadError}</p>

            <button
              type="button"
              className="product-detail-state-link"
              onClick={() =>
                setReloadKey(
                  previous => previous + 1
                )
              }
            >
              Thử lại
            </button>
          </div>
        </main>

        <InformComponent />
      </div>
    );
  }

  if (!product) {
    return (
      <div>
        <MenuComponent />

        <main className="container product-detail-page">
          <div className="product-detail-state">
            <h2>
              Không tìm thấy sản phẩm
            </h2>

            <Link
              to="/"
              className="product-detail-state-link"
            >
              Quay về trang chủ
            </Link>
          </div>
        </main>

        <InformComponent />
      </div>
    );
  }

  const imageSrc =
    getImageSrc(
      product.image
    );

  const categoryName =
    getCategoryName(
      product
    );

  const categoryPath =
    getCategoryPath(
      product
    );

  return (
    <div>
      <MenuComponent />

      {cartFeedback > 0 && (
        <div
          role="status"
          style={{ position: 'fixed', top: 100, right: 20, zIndex: 1000,
            maxWidth: 'calc(100vw - 40px)', padding: '12px 18px',
            background: '#fff0f5', color: '#8f0038', borderRadius: 8,
            boxShadow: '0 2px 12px #0002' }}
        >
          Đã thêm sản phẩm vào giỏ hàng.
        </div>
      )}
      <main className="container product-detail-page product-detail-full-page">
        <nav
          className="product-breadcrumb"
          aria-label="Breadcrumb"
        >
          <Link to="/">
            Trang chủ
          </Link>

          <span>/</span>

          <Link
            to={categoryPath}
          >
            {categoryName ||
              'Danh mục sản phẩm'}
          </Link>

          <span>/</span>

          <span
            className="product-breadcrumb-current"
          >
            {product.name}
          </span>
        </nav>

        <section className="product-detail-layout">
          <div className="product-detail-image-box">
            <img
              src={imageSrc}
              alt={product.name}
              className="product-detail-big-image"
              onError={event => {
                event.currentTarget.src =
                  'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=800&q=80';
              }}
            />
          </div>

          <div className="product-detail-info-box">
            <h1>
              {product.name}
            </h1>

            {discountInfo.hasDiscount ? (
              <div className="product-price-block">
                <p className="product-original-price">
                  {formatMoney(
                    discountInfo.originalPrice
                  )}{' '}
                  đ
                </p>

                <p className="detail-price">
                  {formatMoney(
                    discountInfo.finalPrice
                  )}{' '}
                  đ
                </p>

                <p className="product-saving-text">
                  {discountInfo.discountLabel}
                  {' • '}
                  Tiết kiệm{' '}
                  {formatMoney(
                    discountInfo.savedAmount
                  )}{' '}
                  đ
                </p>
              </div>
            ) : (
              <div className="product-price-block">
                <p className="detail-price">
                  {formatMoney(
                    discountInfo.originalPrice
                  )}{' '}
                  đ
                </p>
              </div>
            )}

            <div className="product-stock-wrap">
              <span
                className={
                  stockClass
                }
              >
                {stockText}
              </span>

              <p className="product-stock-note">
                Tồn kho hiện tại:{' '}
                <strong>
                  {currentStock}
                </strong>
              </p>
            </div>

            <div className="product-rating-summary">
              <div className="product-rating-summary-score">
                {Number(
                  reviewSummary.averageRating ||
                  0
                ).toFixed(1)}
                /5
              </div>

              <div className="product-rating-summary-text">
                {reviewSummary.reviewCount ||
                  0}{' '}
                lượt đánh giá
              </div>
            </div>

            <button
              type="button"
              className="zalo-btn"
            >
              CHAT ZALO
            </button>

            <p className="product-commit-text">
              Cam kết sử dụng hoa mới,
              không sử dụng hoa đông lạnh.
            </p>

            {isLowStock && (
              <p className="product-low-stock-alert">
                Sản phẩm đang sắp hết hàng,
                vui lòng đặt sớm.
              </p>
            )}

            {isOutOfStock && (
              <p className="product-out-stock-alert">
                Sản phẩm hiện đã hết hàng,
                vui lòng chọn mẫu khác hoặc liên hệ shop.
              </p>
            )}

            <div className="product-feature-box">
              <h3>
                Đặc biệt
              </h3>

              <ul>
                <li>
                  Tặng miễn phí banner, thiệp
                </li>

                <li>
                  Giao tận nơi nội thành
                </li>

                <li>
                  Có hỗ trợ giao trong ngày
                  tùy khả năng phục vụ
                </li>

                <li>
                  Gửi hình thành phẩm trước khi giao
                </li>

                <li>
                  Hoa được chuẩn bị theo đơn
                  và tình trạng nguyên liệu thực tế
                </li>

                <li>
                  Hỗ trợ tư vấn trước khi đặt hàng
                </li>
              </ul>
            </div>

            {product.description && (
              <div className="product-description">
                {product.description}
              </div>
            )}

            <div className="product-detail-actions detail-action-buttons">
              <button
                type="button"
                onClick={() =>
                  addToCart(
                    product
                  )
                }
                className="add-cart-btn"
                disabled={
                  isOutOfStock
                }
              >
                {isOutOfStock
                  ? 'Hết hàng'
                  : 'Thêm vào giỏ hàng'}
              </button>

              <button
                type="button"
                onClick={() =>
                  handleBuyNow(
                    product
                  )
                }
                className="buy-now-btn"
                disabled={
                  isOutOfStock
                }
              >
                {isOutOfStock
                  ? 'Hết hàng'
                  : 'Mua ngay'}
              </button>
            </div>
          </div>
        </section>

        <section className="product-info-tabs">
          <div
            className="tab-header"
            role="tablist"
            aria-label="Thông tin mua hàng"
          >
            <button
              type="button"
              role="tab"
              aria-selected={
                activeTab ===
                'shipping'
              }
              className={
                activeTab ===
                'shipping'
                  ? 'tab-btn active'
                  : 'tab-btn'
              }
              onClick={() =>
                setActiveTab(
                  'shipping'
                )
              }
            >
              Chính sách giao hàng
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={
                activeTab ===
                'payment'
              }
              className={
                activeTab ===
                'payment'
                  ? 'tab-btn active'
                  : 'tab-btn'
              }
              onClick={() =>
                setActiveTab(
                  'payment'
                )
              }
            >
              Hình thức thanh toán
            </button>
          </div>

          <div className="tab-content-box">
            {activeTab ===
              'shipping' && (
              <div className="tab-content-detail">
                <h3>
                  Chính sách giao hàng Wind Flower
                </h3>

                <ul className="product-policy-list">
                  <li>
                    Phí giao hàng tiêu chuẩn:
                    <strong>
                      {' '}30.000 đ
                    </strong>.
                  </li>

                  <li>
                    Miễn phí giao hàng khi tổng
                    tiền sản phẩm trước voucher
                    từ{' '}
                    <strong>
                      1.500.000 đ
                    </strong>.
                  </li>

                  <li>
                    Đơn đặt trước 15:00 có thể
                    được xem xét giao trong ngày,
                    tùy khả năng phục vụ.
                  </li>

                  <li>
                    Sau 15:00, thời gian giao sớm
                    nhất thông thường là ngày kế tiếp.
                  </li>

                  <li>
                    Khung giờ giao khách chọn là
                    khung giờ mong muốn, không phải
                    cam kết một thời điểm chính xác.
                  </li>

                  <li>
                    Khách có thể yêu cầu thay đổi
                    trước khi đơn được chuẩn bị hoặc
                    giao. Sau thời điểm đó, shop chỉ
                    hỗ trợ nếu điều kiện thực tế cho phép.
                  </li>
                </ul>

                <Link
                  to="/chinh-sach-giao-hang"
                  className="product-policy-link"
                >
                  Xem chính sách giao hàng đầy đủ
                </Link>
              </div>
            )}

            {activeTab ===
              'payment' && (
              <div className="tab-content-detail">
                <h3>
                  Hình thức thanh toán
                </h3>

                <ul className="product-policy-list">
                  <li>
                    <strong>
                      Thanh toán khi nhận hàng (COD):
                    </strong>{' '}
                    đang được hỗ trợ.
                  </li>

                  <li>
                    <strong>
                      Chuyển khoản:
                    </strong>{' '}
                    luồng thanh toán trên website hiện
                    đang ở chế độ demo.
                  </li>

                  <li>
                    <strong>
                      MoMo:
                    </strong>{' '}
                    luồng thanh toán trên website hiện
                    đang ở chế độ demo.
                  </li>

                  <li>
                    Tổng thanh toán cuối cùng được
                    xác định tại bước Checkout sau khi
                    áp dụng voucher và phí giao hàng.
                  </li>
                </ul>

                <div className="product-policy-actions">
                  <Link
                    to="/hinh-thuc-thanh-toan"
                    className="product-policy-link"
                  >
                    Xem hình thức thanh toán
                  </Link>

                  <span className="product-policy-hotline">
                    Hotline: 0931303836
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="product-reviews-section">
          <div className="product-reviews-heading">
            <div>
              <span className="product-section-eyebrow">
                KHÁCH HÀNG
              </span>

              <h2>
                Đánh giá sản phẩm
              </h2>
            </div>
          </div>

          <div className="product-review-overview">
            <div className="product-review-score-card">
              <strong>
                {Number(
                  reviewSummary.averageRating ||
                  0
                ).toFixed(1)}
                /5
              </strong>

              <span>
                {reviewSummary.reviewCount ||
                  0}{' '}
                đánh giá
              </span>
            </div>

            <p className="product-review-guide">
  Sau khi đơn hàng được giao thành công,
  bạn có thể vào phần{' '}
  <strong>
    Đơn hàng của tôi
  </strong>{' '}
  để gửi đánh giá.
</p>
          </div>

          {reviewsLoading ? (
            <p className="product-review-status">
              Đang tải đánh giá...
            </p>
          ) : reviewLoadError ? (
            <p className="product-review-status" role="alert">
              {reviewLoadError}
            </p>
          ) : reviews.length === 0 ? (
            <div className="product-review-empty">
              Chưa có đánh giá nào cho sản phẩm này.
            </div>
          ) : (
            <div className="product-review-list">
              {reviews.map(
                review => (
                  <article
                    key={
                      review._id
                    }
                    className="product-review-item"
                  >
                    <div className="product-review-item-head">
                      <div>
                        <p className="product-review-customer">
                          {review.customer
                            ?.name ||
                            review.customer
                              ?.username ||
                            'Khách hàng'}
                        </p>

                        <p className="product-review-stars">
                          {renderStars(
                            review.rating
                          )}
                        </p>
                      </div>

                      <time className="product-review-date">
                        {formatReviewDate(
                          review.cdate
                        )}
                      </time>
                    </div>

                    <p className="product-review-comment">
                      {review.comment ||
                        'Không có nội dung đánh giá.'}
                    </p>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <section className="related-products-section">
          <div className="related-products-heading">
            <span className="product-section-eyebrow">
              GỢI Ý THÊM
            </span>

            <h2>
              Sản phẩm liên quan
            </h2>
          </div>

          {relatedProducts.length ===
            0 ? (
            <p className="no-products-text">
              Chưa có sản phẩm liên quan.
            </p>
          ) : (
            <div className="wf-related-product-grid">
              {relatedProducts.map(
                item => {
                  const relatedDiscount =
                    getDiscountInfo(
                      item
                    );

                  return (
                    <Link
                      to={`/product/${item._id}`}
                      className="related-product-link"
                      key={
                        item._id
                      }
                    >
                      <article className="wf-product-card related-product-card">
                        <span className="wf-product-card-image-link">
                          <img
                            className="wf-product-card-image"
                            src={getImageSrc(
                              item.image
                            )}
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
                        </span>

                        <h3 className="wf-product-card-name">
                          {item.name}
                        </h3>

                        <div className="wf-product-card-price-box">
                          {relatedDiscount.hasDiscount ? (
                            <>
                              <p className="wf-product-card-original-price">
                                {formatMoney(
                                  relatedDiscount.originalPrice
                                )}{' '}
                                đ
                              </p>

                              <p className="wf-product-card-price">
                                {formatMoney(
                                  relatedDiscount.finalPrice
                                )}{' '}
                                đ
                              </p>
                            </>
                          ) : (
                            <p className="wf-product-card-price">
                              {formatMoney(
                                relatedDiscount.originalPrice
                              )}{' '}
                              đ
                            </p>
                          )}
                        </div>
                      </article>
                    </Link>
                  );
                }
              )}
            </div>
          )}
        </section>
      </main>

      <InformComponent />
    </div>
  );
}

export default ProductDetailComponent;