import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function getImageSrc(image) {
  const value = String(image || '').trim();
  if (!value) return '';

  if (value.startsWith('data:image')) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return value;
  if (value.startsWith('./')) return value;

  return `data:image/jpg;base64,${value}`;
}

function getCategoryName(product) {
  if (!product) return '';
  if (typeof product.category === 'string') return product.category;
  return product.category?.name || '';
}

function getCategoryPath(product) {
  const categoryName = normalizeText(getCategoryName(product));
  const categorySlug = normalizeText(product?.categorySlug || '');

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
    'hoa hướng dương': '/category/hoa-huong-duong',
    'hoa cát tường': '/category/hoa-cat-tuong',
    'hoa lan hồ điệp': '/category/hoa-lan-ho-diep'
  };

  return map[categoryName] || '/';
}

function getDiscountInfo(product) {
  const originalPrice = Number(product?.price || 0);
  const discountPercent = Math.max(0, Math.min(100, Number(product?.discountPercent || 0)));
  const discountPrice = Math.max(0, Number(product?.discountPrice || 0));

  let finalPrice = originalPrice;
  let discountLabel = '';

  if (discountPrice > 0 && discountPrice < originalPrice) {
    const priceAfterFixedDiscount = originalPrice - discountPrice;
    if (priceAfterFixedDiscount < finalPrice) {
      finalPrice = priceAfterFixedDiscount;
      discountLabel = `Giảm ${formatMoney(discountPrice)} đ`;
    }
  }

  if (discountPercent > 0) {
    const priceAfterPercent = Math.round(originalPrice * (100 - discountPercent) / 100);
    if (priceAfterPercent < finalPrice) {
      finalPrice = priceAfterPercent;
      discountLabel = `Giảm ${discountPercent}%`;
    }
  }

  finalPrice = Math.max(0, finalPrice);

  return {
    originalPrice,
    finalPrice,
    hasDiscount: finalPrice < originalPrice,
    savedAmount: Math.max(0, originalPrice - finalPrice),
    discountLabel
  };
}

function renderStars(rating) {
  const safeRating = Math.max(1, Math.min(5, Number(rating || 0)));
  return '★'.repeat(safeRating) + '☆'.repeat(5 - safeRating);
}

function formatReviewDate(value) {
  const time = Number(value || 0);
  if (!time) return 'Chưa có ngày';
  return new Date(time).toLocaleString('vi-VN');
}

function ProductDetailComponent() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('shipping');
  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({
    reviewCount: 0,
    averageRating: 0
  });
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setReviewsLoading(true);

        const [productRes, allProductsRes, reviewsRes] = await Promise.all([
          API.get(`/customer/products/${id}`),
          API.get('/customer/all-products'),
          API.get(`/customer/reviews/product/${id}`)
        ]);

        const productData = productRes.data && productRes.data._id ? productRes.data : null;
        const productsData = Array.isArray(allProductsRes.data) ? allProductsRes.data : [];

        const reviewData = Array.isArray(reviewsRes.data?.reviews)
          ? reviewsRes.data.reviews
          : [];
        const summaryData = reviewsRes.data?.summary || {
          reviewCount: 0,
          averageRating: 0
        };

        setProduct(productData);
        setAllProducts(productsData);
        setReviews(reviewData);
        setReviewSummary({
          reviewCount: Number(summaryData.reviewCount || 0),
          averageRating: Number(summaryData.averageRating || 0)
        });
      } catch (error) {
        console.error('Lỗi load chi tiết sản phẩm:', error);
        setProduct(null);
        setAllProducts([]);
        setReviews([]);
        setReviewSummary({
          reviewCount: 0,
          averageRating: 0
        });
      } finally {
        setLoading(false);
        setReviewsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const discountInfo = useMemo(() => getDiscountInfo(product), [product]);

  const currentStock = Number(product?.stock || 0);
  const isOutOfStock = product ? currentStock <= 0 : false;
  const isLowStock = product ? currentStock > 0 && currentStock <= 5 : false;

  const stockText = useMemo(() => {
    if (!product) return 'Đang tải dữ liệu kho...';
    if (currentStock <= 0) return 'Hết hàng';
    if (currentStock <= 5) return `Chỉ còn ${currentStock} sản phẩm`;
    return `Còn ${currentStock} sản phẩm`;
  }, [product, currentStock]);

  const stockClass = useMemo(() => {
    if (!product) return 'product-stock-badge stock-unknown';
    if (currentStock <= 0) return 'product-stock-badge stock-out';
    if (currentStock <= 5) return 'product-stock-badge stock-low';
    return 'product-stock-badge stock-in';
  }, [product, currentStock]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];

    const currentCategoryName = normalizeText(getCategoryName(product));

    return allProducts
      .filter((item) => {
        if (!item || !item._id) return false;
        if (String(item._id) === String(product._id)) return false;

        const itemCategoryName = normalizeText(getCategoryName(item));
        return itemCategoryName === currentCategoryName;
      })
      .slice(0, 4);
  }, [allProducts, product]);

  const addToCart = (currentProduct, showAlert = true) => {
    const customer = localStorage.getItem('customer');
    const token = localStorage.getItem('customerToken');

    if (!customer || !token) {
      alert('Vui lòng đăng nhập để mua hàng.');
      navigate('/login');
      return false;
    }

    if (!currentProduct || !currentProduct._id) {
      alert('Không tìm thấy sản phẩm trong MongoDB.');
      return false;
    }

    const stock = Number(currentProduct.stock || 0);
    if (stock <= 0) {
      alert('Sản phẩm hiện đã hết hàng.');
      return false;
    }

    const discount = getDiscountInfo(currentProduct);

    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const index = cart.findIndex((item) => item._id === currentProduct._id);

    if (index !== -1) {
      const nextQty = Number(cart[index].quantity || 0) + 1;

      if (nextQty > stock) {
        alert(`Sản phẩm "${currentProduct.name}" chỉ còn ${stock} trong kho`);
        return false;
      }

      cart[index].quantity = nextQty;
      cart[index].price = Number(discount.finalPrice || 0);
      cart[index].originalPrice = Number(discount.originalPrice || 0);
      cart[index].discountPercent = Number(currentProduct.discountPercent || 0);
      cart[index].discountPrice = Number(currentProduct.discountPrice || 0);
    } else {
      cart.push({
        _id: currentProduct._id,
        name: currentProduct.name,
        image: getImageSrc(currentProduct.image),
        price: Number(discount.finalPrice || 0),
        originalPrice: Number(discount.originalPrice || 0),
        discountPercent: Number(currentProduct.discountPercent || 0),
        discountPrice: Number(currentProduct.discountPrice || 0),
        quantity: 1
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));

    if (showAlert) {
      alert('Đã thêm vào giỏ hàng!');
      window.location.reload();
    }

    return true;
  };

  const handleBuyNow = (currentProduct) => {
    const ok = addToCart(currentProduct, false);
    if (ok) {
      navigate('/cart');
    }
  };

  if (loading) {
    return (
      <div>
        <MenuComponent />
        <div className="container product-detail-page">
          <h2>Đang tải sản phẩm...</h2>
        </div>
        <InformComponent />
      </div>
    );
  }

  if (!product) {
    return (
      <div>
        <MenuComponent />
        <div className="container product-detail-page">
          <h2>Không tìm thấy sản phẩm</h2>
        </div>
        <InformComponent />
      </div>
    );
  }

  const imageSrc = getImageSrc(product.image);
  const categoryName = getCategoryName(product);
  const categoryPath = getCategoryPath(product);

  return (
    <div>
      <MenuComponent />

      <div className="container product-detail-page product-detail-full-page">
        <div className="product-breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to={categoryPath}>{categoryName || 'Danh mục sản phẩm'}</Link>
          <span>/</span>
          <span>{product.name}</span>
        </div>

        <div className="product-detail-layout">
          <div className="product-detail-image-box">
            <img
              src={imageSrc}
              alt={product.name}
              className="product-detail-big-image"
              onError={(e) => {
                e.target.src =
                  'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=800&q=80';
              }}
            />
          </div>

          <div className="product-detail-info-box">
            <h1>{product.name}</h1>

            {discountInfo.hasDiscount ? (
              <div style={{ marginBottom: '12px' }}>
                <p
                  style={{
                    margin: 0,
                    textDecoration: 'line-through',
                    color: '#888',
                    fontSize: '18px'
                  }}
                >
                  {formatMoney(discountInfo.originalPrice)} đ
                </p>
                <p className="detail-price" style={{ margin: '6px 0' }}>
                  {formatMoney(discountInfo.finalPrice)} đ
                </p>
                <p style={{ margin: 0, color: '#d81b60', fontWeight: 600 }}>
                  {discountInfo.discountLabel} • Tiết kiệm {formatMoney(discountInfo.savedAmount)} đ
                </p>
              </div>
            ) : (
              <p className="detail-price">
                {formatMoney(discountInfo.originalPrice)} đ
              </p>
            )}

            <div className="product-stock-wrap">
              <span className={stockClass}>{stockText}</span>

              <p className="product-stock-note">
                Tồn kho hiện tại: <strong>{currentStock}</strong>
              </p>
            </div>

            <div
              style={{
                margin: '12px 0 16px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#fff7fb',
                border: '1px solid #f7cfe0'
              }}
            >
              <p style={{ margin: 0, fontWeight: 700, color: '#d81b60' }}>
                Đánh giá trung bình: {Number(reviewSummary.averageRating || 0).toFixed(1)}/5
              </p>
              <p style={{ margin: '6px 0 0', color: '#555' }}>
                {reviewSummary.reviewCount || 0} lượt đánh giá
              </p>
            </div>

            <button className="zalo-btn">CHAT ZALO</button>

            <p className="product-commit-text">
              Cam kết sử dụng hoa mới, không sử dụng hoa đông lạnh.
            </p>

            {isLowStock && (
              <p className="product-low-stock-alert">
                Sản phẩm đang sắp hết hàng, vui lòng đặt sớm.
              </p>
            )}

            {isOutOfStock && (
              <p className="product-out-stock-alert">
                Sản phẩm hiện đã hết hàng, vui lòng chọn mẫu khác hoặc liên hệ shop.
              </p>
            )}

            <div className="product-feature-box">
              <h3>Đặc biệt</h3>
              <ul>
                <li>Tặng miễn phí banner, thiệp</li>
                <li>Giao tận nơi nội thành</li>
                <li>Có giao nhanh</li>
                <li>Gửi hình thành phẩm trước khi giao</li>
                <li>Cam kết hoa tươi trên 3 ngày</li>
                <li>Có hóa đơn đỏ</li>
              </ul>
            </div>

            <p className="product-description">{product.description}</p>

            <div className="product-detail-actions detail-action-buttons">
              <button
                onClick={() => addToCart(product)}
                className="add-cart-btn"
                disabled={isOutOfStock}
              >
                {isOutOfStock ? 'Hết hàng' : 'Thêm vào giỏ hàng'}
              </button>

              <button
                onClick={() => handleBuyNow(product)}
                className="buy-now-btn"
                disabled={isOutOfStock}
              >
                {isOutOfStock ? 'Hết hàng' : 'Mua ngay'}
              </button>
            </div>
          </div>
        </div>

        <div className="product-info-tabs">
          <div className="tab-header">
            <button
              className={activeTab === 'shipping' ? 'tab-btn active' : 'tab-btn'}
              onClick={() => setActiveTab('shipping')}
            >
              Chính sách Giao Hàng
            </button>
            <button
              className={activeTab === 'payment' ? 'tab-btn active' : 'tab-btn'}
              onClick={() => setActiveTab('payment')}
            >
              Hình Thức Thanh Toán
            </button>
          </div>

          <div className="tab-content-box">
            {activeTab === 'shipping' && (
              <div className="tab-content-detail">
                <p><strong>I – Giá vận chuyển</strong></p>
                <p>Miễn phí giao các quận trung tâm nội thành.</p>
                <p>Các quận xa hơn sẽ phụ thu theo khoảng cách giao hàng.</p>
                <p>
                  Các đơn hàng trên 1.500.000đ được hỗ trợ giao hàng miễn phí ở một số khu vực.
                </p>
                <ol>
                  <li>Sản phẩm thực tế sẽ giống mẫu khoảng 70–80% tùy mùa hoa.</li>
                  <li>Nếu thiếu loại hoa, shop sẽ thay thế bằng hoa tương đương.</li>
                  <li>Cam kết cung cấp hoa tươi, không dùng hoa héo hoặc hoa cũ.</li>
                  <li>Nếu sản phẩm lỗi do vận chuyển, shop hỗ trợ đổi mới.</li>
                  <li>Hoa được nhập mới trong ngày để đảm bảo độ tươi lâu.</li>
                </ol>
              </div>
            )}

            {activeTab === 'payment' && (
              <div className="tab-content-detail">
                <h3>Hình Thức Thanh Toán</h3>
                <p>Quý khách có thể lựa chọn một trong các hình thức sau:</p>
                <p><strong>Tiền mặt:</strong> Thanh toán trực tiếp tại cửa hàng.</p>
                <p><strong>Thanh toán khi nhận hoa:</strong> Áp dụng với đơn nội thành phù hợp.</p>
                <p><strong>Chuyển khoản:</strong> Liên hệ hotline để nhận thông tin tài khoản.</p>
                <p>Hotline hỗ trợ: <strong>0931303836</strong></p>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '22px',
            marginTop: '28px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Đánh giá sản phẩm</h2>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: '18px'
            }}
          >
            <div
              style={{
                minWidth: '180px',
                padding: '14px 16px',
                borderRadius: '14px',
                background: '#fff7fb',
                border: '1px solid #f7cfe0'
              }}
            >
              <p style={{ margin: 0, color: '#d81b60', fontWeight: 700, fontSize: '22px' }}>
                {Number(reviewSummary.averageRating || 0).toFixed(1)}/5
              </p>
              <p style={{ margin: '6px 0 0', color: '#555' }}>
                {reviewSummary.reviewCount || 0} đánh giá
              </p>
            </div>

            <div style={{ color: '#666' }}>
              Khách hàng đã mua hàng có thể vào phần <strong>Đơn hàng của tôi</strong> để gửi đánh giá.
            </div>
          </div>

          {reviewsLoading ? (
            <p>Đang tải đánh giá...</p>
          ) : reviews.length === 0 ? (
            <div
              style={{
                padding: '18px',
                borderRadius: '12px',
                background: '#fafafa',
                border: '1px dashed #ddd'
              }}
            >
              Chưa có đánh giá nào cho sản phẩm này.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {reviews.map((review) => (
                <div
                  key={review._id}
                  style={{
                    border: '1px solid #eee',
                    borderRadius: '14px',
                    padding: '16px',
                    background: '#fff'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                      marginBottom: '8px'
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 700 }}>
                        {review.customer?.name || review.customer?.username || 'Khách hàng'}
                      </p>
                      <p style={{ margin: '4px 0 0', color: '#f59e0b', fontWeight: 700 }}>
                        {renderStars(review.rating)}
                      </p>
                    </div>

                    <div style={{ color: '#777', fontSize: '14px' }}>
                      {formatReviewDate(review.cdate)}
                    </div>
                  </div>

                  <p style={{ margin: 0, color: '#333', lineHeight: 1.6 }}>
                    {review.comment || 'Không có nội dung đánh giá.'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="related-products-section">
          <h2>Sản phẩm liên quan</h2>

          {relatedProducts.length === 0 ? (
            <p className="no-products-text">Chưa có sản phẩm liên quan.</p>
          ) : (
            <div className="home-product-grid">
              {relatedProducts.map((item) => {
                const relatedDiscount = getDiscountInfo(item);

                return (
                  <Link
                    to={`/product/${item._id}`}
                    className="related-product-link"
                    key={item._id}
                  >
                    <div className="home-product-card related-product-card">
                      <img
                        src={getImageSrc(item.image)}
                        alt={item.name}
                        onError={(e) => {
                          e.target.src =
                            'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=500&q=80';
                        }}
                      />
                      <h3>{item.name}</h3>

                      {relatedDiscount.hasDiscount ? (
                        <div>
                          <p
                            style={{
                              margin: '0 0 4px',
                              textDecoration: 'line-through',
                              color: '#888',
                              fontSize: '14px'
                            }}
                          >
                            {formatMoney(relatedDiscount.originalPrice)} đ
                          </p>
                          <p className="price" style={{ margin: 0 }}>
                            {formatMoney(relatedDiscount.finalPrice)} đ
                          </p>
                        </div>
                      ) : (
                        <p className="price">
                          {formatMoney(relatedDiscount.originalPrice)} đ
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default ProductDetailComponent;