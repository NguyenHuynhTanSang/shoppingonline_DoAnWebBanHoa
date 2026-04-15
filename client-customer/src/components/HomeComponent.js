import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../services/api';

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

function getCategorySlug(product) {
  if (!product) return '';
  if (typeof product.category === 'string') return '';
  return product.category?.slug || product.categorySlug || '';
}

function getSubmenuName(product) {
  if (!product) return '';
  return product.submenu?.name || '';
}

function getSubmenuSlug(product) {
  if (!product) return '';
  return product.submenu?.slug || '';
}

function getPricingInfo(product) {
  const originalPrice = Number(product?.originalPrice ?? product?.price ?? 0);
  let finalPrice = Number(product?.finalPrice ?? product?.price ?? 0);

  const discountPercent = Math.max(0, Math.min(100, Number(product?.discountPercent || 0)));
  const discountPrice = Math.max(0, Number(product?.discountPrice || 0));

  if (!product?.finalPrice) {
    if (discountPrice > 0 && discountPrice < originalPrice) {
      finalPrice = Math.min(finalPrice, originalPrice - discountPrice);
    }

    if (discountPercent > 0) {
      finalPrice = Math.min(
        finalPrice,
        Math.round(originalPrice * (100 - discountPercent) / 100)
      );
    }
  }

  finalPrice = Math.max(0, finalPrice);

  return {
    originalPrice,
    finalPrice,
    hasDiscount: finalPrice < originalPrice,
    savedAmount: Math.max(0, originalPrice - finalPrice)
  };
}

function belongsToCategory(product, categoryKey) {
  const categoryName = normalizeText(getCategoryName(product));
  const categorySlug = normalizeText(getCategorySlug(product));
  const submenuName = normalizeText(getSubmenuName(product));
  const submenuSlug = normalizeText(getSubmenuSlug(product));

  switch (categoryKey) {
    case 'bo-hoa-8-3':
      return (
        categoryName === 'bó hoa 8-3' ||
        categoryName === 'bó hoa' ||
        categorySlug === 'bo-hoa-8-3'
      );

    case 'gio-hoa-8-3':
      return (
        categoryName === 'giỏ hoa 8-3' ||
        categoryName === 'giỏ hoa' ||
        categorySlug === 'gio-hoa-8-3'
      );

    case 'binh-hoa-8-3':
      return (
        categoryName === 'bình hoa 8-3' ||
        categoryName === 'bình hoa' ||
        categorySlug === 'binh-hoa-8-3'
      );

    case 'tulip':
      return (
        categoryName === 'hoa tulip' ||
        categoryName === 'tulip' ||
        categorySlug === 'tulip' ||
        categorySlug === 'hoa-tulip' ||
        submenuSlug === 'tulip' ||
        submenuSlug === 'hoa-tulip'
      );

    case 'tang-me':
    case 'hoa-tang-me':
      return (
        categoryName === 'hoa tặng mẹ' ||
        categoryName === 'tặng mẹ' ||
        categorySlug === 'tang-me' ||
        categorySlug === 'hoa-tang-me' ||
        submenuName === 'tặng mẹ' ||
        submenuName === 'hoa tặng mẹ' ||
        submenuSlug === 'tang-me' ||
        submenuSlug === 'hoa-tang-me'
      );

    default:
      return false;
  }
}

function buildStockInfo(product) {
  const stock = Number(product?.stock || 0);
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 5;

  if (isOutOfStock) {
    return {
      stock,
      isOutOfStock: true,
      isLowStock: false,
      text: 'Hết hàng',
      className: 'product-stock-badge stock-out'
    };
  }

  if (isLowStock) {
    return {
      stock,
      isOutOfStock: false,
      isLowStock: true,
      text: `Chỉ còn ${stock} sản phẩm`,
      className: 'product-stock-badge stock-low'
    };
  }

  return {
    stock,
    isOutOfStock: false,
    isLowStock: false,
    text: `Còn ${stock} sản phẩm`,
    className: 'product-stock-badge stock-in'
  };
}

function HomeComponent() {
  const navigate = useNavigate();
  const [dbProducts, setDbProducts] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);

  useEffect(() => {
    const fetchDbProducts = async () => {
      try {
        setLoadingDb(true);
        const res = await API.get('/customer/all-products');
        setDbProducts(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Lỗi load sản phẩm từ DB:', error);
        setDbProducts([]);
      } finally {
        setLoadingDb(false);
      }
    };

    fetchDbProducts();
  }, []);

  const bouquetProducts = useMemo(() => {
    return dbProducts.filter((item) => belongsToCategory(item, 'bo-hoa-8-3')).slice(0, 5);
  }, [dbProducts]);

  const basketProducts = useMemo(() => {
    return dbProducts.filter((item) => belongsToCategory(item, 'gio-hoa-8-3')).slice(0, 5);
  }, [dbProducts]);

  const vaseProducts = useMemo(() => {
    return dbProducts.filter((item) => belongsToCategory(item, 'binh-hoa-8-3')).slice(0, 5);
  }, [dbProducts]);

  const tulipProducts = useMemo(() => {
    return dbProducts.filter((item) => belongsToCategory(item, 'tulip')).slice(0, 5);
  }, [dbProducts]);

  const tangMeProducts = useMemo(() => {
    return dbProducts.filter((item) => belongsToCategory(item, 'hoa-tang-me')).slice(0, 5);
  }, [dbProducts]);

  const tulipLink = useMemo(() => {
    const first = tulipProducts[0];
    const slug = first?.category?.slug || first?.submenu?.slug || 'tulip';
    return `/category/${slug}`;
  }, [tulipProducts]);

  const tangMeLink = useMemo(() => {
    const first = tangMeProducts[0];
    const slug = first?.category?.slug || first?.submenu?.slug || 'hoa-tang-me';
    return `/category/${slug}`;
  }, [tangMeProducts]);

  const categories = useMemo(() => {
    return [
      {
        id: 1,
        name: 'Giỏ hoa',
        image: '/images/gio-hoa.png',
        link: '/category/gio-hoa-8-3'
      },
      {
        id: 2,
        name: 'Bó hoa',
        image: '/images/bo-hoa.png',
        link: '/category/bo-hoa-8-3'
      },
      {
        id: 3,
        name: 'Bình hoa',
        image: '/images/binh-hoa.png',
        link: '/category/binh-hoa-8-3'
      },
      {
        id: 4,
        name: 'Tulip',
        image: '/images/tulip.png',
        link: tulipLink
      },
      {
        id: 5,
        name: 'Hoa tặng mẹ',
        image: '/images/me.png',
        link: tangMeLink
      }
    ];
  }, [tulipLink, tangMeLink]);

  const addToCart = (product) => {
    const customer = localStorage.getItem('customer');
    const token = localStorage.getItem('customerToken');

    if (!customer || !token) {
      alert('Vui lòng đăng nhập để mua hàng.');
      navigate('/login');
      return;
    }

    if (!product || !product._id) {
      alert('Không tìm thấy sản phẩm trong MongoDB.');
      return;
    }

    const stock = Number(product.stock || 0);
    if (stock <= 0) {
      alert('Sản phẩm hiện đã hết hàng.');
      return;
    }

    const pricing = getPricingInfo(product);

    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const index = cart.findIndex((item) => item._id === product._id);

    if (index !== -1) {
      const nextQty = Number(cart[index].quantity || 0) + 1;
      if (nextQty > stock) {
        alert(`Sản phẩm "${product.name}" chỉ còn ${stock} trong kho`);
        return;
      }
      cart[index].quantity = nextQty;
      cart[index].price = Number(pricing.finalPrice || 0);
      cart[index].originalPrice = Number(pricing.originalPrice || 0);
      cart[index].discountPercent = Number(product.discountPercent || 0);
      cart[index].discountPrice = Number(product.discountPrice || 0);
    } else {
      cart.push({
        _id: product._id,
        name: product.name,
        image: getImageSrc(product.image),
        price: Number(pricing.finalPrice || 0),
        originalPrice: Number(pricing.originalPrice || 0),
        discountPercent: Number(product.discountPercent || 0),
        discountPrice: Number(product.discountPrice || 0),
        quantity: 1
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    alert('Đã thêm vào giỏ hàng!');
    window.location.reload();
  };

  const reviews = [
    {
      id: 1,
      name: 'Anh Hoàng - Quận 2',
      content: 'Đặt hoa cho người thân rất đẹp, giao đúng giờ và đóng gói cẩn thận.',
      image: '/images/gio-hoa.png'
    },
    {
      id: 2,
      name: 'Chị Ngọc Lan - Phú Nhuận',
      content: 'Lần đầu đặt mà rất hài lòng. Hoa tươi, đúng mẫu và tư vấn dễ thương.',
      image: '/images/bo-hoa-tulip-hong-sang-trong-thanh-lich.png'
    },
    {
      id: 3,
      name: 'Anh Tú - Quận 7',
      content: 'Dịch vụ nhanh, giao đẹp, sẽ tiếp tục ủng hộ shop trong những dịp sau.',
      image: '/images/bo-tulip-cam.png'
    },
    {
      id: 4,
      name: 'Bạn Hoài Thương - Q5',
      content: 'Mình đặt qua website rất tiện. Giá ổn, mẫu hoa nhìn sang và đẹp.',
      image: '/images/binh-hoa-huong-duong.png'
    }
  ];

  const renderProductSection = (title, slug, items) => (
    <section className="home-product-section">
      <div className="section-head">
        <h2>{title}</h2>
        <Link to={slug} className="section-more-btn">
          XEM THÊM
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="no-products-text">
          {loadingDb ? 'Đang tải sản phẩm...' : 'Chưa có sản phẩm trong danh mục này.'}
        </p>
      ) : (
        <div className="home-product-grid">
          {items.map((item) => {
            const stockInfo = buildStockInfo(item);
            const imageSrc = getImageSrc(item.image);
            const pricing = getPricingInfo(item);

            return (
              <div className="home-product-card" key={item._id}>
                <Link to={`/product/${item._id}`}>
                  <img
                    src={imageSrc}
                    alt={item.name}
                    onError={(e) => {
                      e.target.src = '/images/tang-hoa.png';
                    }}
                  />
                </Link>

                <h3>{item.name}</h3>

                {pricing.hasDiscount ? (
                  <div>
                    <p
                      style={{
                        margin: '0 0 4px',
                        textDecoration: 'line-through',
                        color: '#888',
                        fontSize: '14px'
                      }}
                    >
                      {formatMoney(pricing.originalPrice)} đ
                    </p>
                    <p className="price" style={{ margin: 0 }}>
                      {formatMoney(pricing.finalPrice)} đ
                    </p>
                  </div>
                ) : (
                  <p className="price">{formatMoney(pricing.originalPrice)} đ</p>
                )}

                <div className="home-stock-box">
                  <span className={stockInfo.className}>{stockInfo.text}</span>
                </div>

                <div className="product-actions">
                  <button
                    onClick={() => addToCart(item)}
                    disabled={stockInfo.isOutOfStock}
                  >
                    {stockInfo.isOutOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
                  </button>

                  <button
                    className="detail-btn"
                    onClick={() => navigate(`/product/${item._id}`)}
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="home-page">
      <div className="container">
        <section className="home-banner-section">
          <Link to="/category/bo-hoa-8-3" className="home-banner-link">
            <img
              className="home-main-banner"
              src="https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?auto=format&fit=crop&w=1400&q=80"
              alt="Banner hoa 8-3"
            />
          </Link>
        </section>

        <section className="home-round-category-section">
          <div className="home-round-category-list">
            {categories.map((item) => (
              <Link to={item.link} className="home-round-category-item" key={item.id}>
                <img src={item.image} alt={item.name} />
                <p>{item.name}</p>
              </Link>
            ))}
          </div>
        </section>

        {renderProductSection('Bó Hoa Tặng 8-3', '/category/bo-hoa-8-3', bouquetProducts)}
        {renderProductSection('Giỏ Hoa Tặng 8-3', '/category/gio-hoa-8-3', basketProducts)}
        {renderProductSection('Bình Hoa Cao Cấp 8-3', '/category/binh-hoa-8-3', vaseProducts)}
        {renderProductSection('Hoa Tulip Tặng 8-3', tulipLink, tulipProducts)}

        <section className="review-section">
          <h2>Đánh Giá</h2>
          <div className="review-grid">
            {reviews.map((item) => (
              <div className="review-card" key={item.id}>
                <div className="review-image">
                  <img src={item.image} alt={item.name} />
                </div>
                <div className="review-content">
                  <p>{item.content}</p>
                  <span>{item.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default HomeComponent;