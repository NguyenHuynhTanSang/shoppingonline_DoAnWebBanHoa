import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function toSlug(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function formatSlugToTitle(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return 'Danh mục sản phẩm';

  const map = {
    'bo-hoa-8-3': 'Bó hoa 8-3',
    'gio-hoa-8-3': 'Giỏ hoa 8-3',
    'binh-hoa-8-3': 'Bình hoa 8-3',
    'tulip': 'Tulip',
    'hoa-tulip': 'Tulip',
    'tang-me': 'Hoa tặng mẹ',
    'hoa-tang-me': 'Hoa tặng mẹ'
  };

  if (map[raw]) return map[raw];

  return raw
    .split('-')
    .map((part) => {
      if (!part) return '';
      if (/^\d+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
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

function getSubmenuName(product) {
  if (!product) return '';
  if (typeof product.submenu === 'string') return product.submenu;
  return product.submenu?.name || '';
}

function getCategorySlug(product) {
  if (!product) return '';

  if (typeof product.category === 'object' && product.category?.slug) {
    return normalizeText(product.category.slug);
  }

  if (product.categorySlug) {
    return normalizeText(product.categorySlug);
  }

  return toSlug(getCategoryName(product));
}

function getSubmenuSlug(product) {
  if (!product) return '';

  if (typeof product.submenu === 'object' && product.submenu?.slug) {
    return normalizeText(product.submenu.slug);
  }

  return toSlug(getSubmenuName(product));
}

function getSlugAliases(slug) {
  const normalized = normalizeText(slug);

  const aliasMap = {
    'bo-hoa-8-3': ['bo-hoa-8-3', 'bo-hoa'],
    'gio-hoa-8-3': ['gio-hoa-8-3', 'gio-hoa'],
    'binh-hoa-8-3': ['binh-hoa-8-3', 'binh-hoa'],
    'tulip': ['tulip', 'hoa-tulip'],
    'hoa-tulip': ['tulip', 'hoa-tulip'],
    'tang-me': ['tang-me', 'hoa-tang-me'],
    'hoa-tang-me': ['tang-me', 'hoa-tang-me']
  };

  return aliasMap[normalized] || [normalized];
}

function belongsToSlug(product, slug) {
  const aliases = getSlugAliases(slug);

  const categorySlug = getCategorySlug(product);
  const submenuSlug = getSubmenuSlug(product);
  const categoryNameSlug = toSlug(getCategoryName(product));
  const submenuNameSlug = toSlug(getSubmenuName(product));

  return (
    aliases.includes(categorySlug) ||
    aliases.includes(submenuSlug) ||
    aliases.includes(categoryNameSlug) ||
    aliases.includes(submenuNameSlug)
  );
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

function CategoryPageComponent() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [priceFilter, setPriceFilter] = useState('all');
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

  const title = useMemo(() => {
    const normalizedSlug = normalizeText(slug);

    const matchedSubmenuProduct = dbProducts.find((item) => belongsToSlug(item, normalizedSlug));
    if (matchedSubmenuProduct) {
      const submenuSlug = getSubmenuSlug(matchedSubmenuProduct);
      if (getSlugAliases(normalizedSlug).includes(submenuSlug) && getSubmenuName(matchedSubmenuProduct)) {
        return getSubmenuName(matchedSubmenuProduct);
      }

      if (getCategoryName(matchedSubmenuProduct)) {
        return getCategoryName(matchedSubmenuProduct);
      }
    }

    return formatSlugToTitle(slug);
  }, [dbProducts, slug]);

  const categoryProducts = useMemo(() => {
    return dbProducts.filter((item) => belongsToSlug(item, slug));
  }, [dbProducts, slug]);

  const filterByPrice = useCallback(
    (items) => {
      switch (priceFilter) {
        case 'under-1000':
          return items.filter((item) => Number(getPricingInfo(item).finalPrice || 0) < 1000000);
        case '1000-2000':
          return items.filter((item) => {
            const price = Number(getPricingInfo(item).finalPrice || 0);
            return price >= 1000000 && price <= 2000000;
          });
        case '2000-3000':
          return items.filter((item) => {
            const price = Number(getPricingInfo(item).finalPrice || 0);
            return price > 2000000 && price <= 3000000;
          });
        case 'over-3000':
          return items.filter((item) => Number(getPricingInfo(item).finalPrice || 0) > 3000000);
        default:
          return items;
      }
    },
    [priceFilter]
  );

  const filteredProducts = useMemo(() => {
    return filterByPrice(categoryProducts);
  }, [categoryProducts, filterByPrice]);

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

  return (
    <div>
      <MenuComponent />

      <div className="container category-page">
        <h1 className="category-page-title">{title}</h1>
        <p className="category-page-desc">
          Khám phá các sản phẩm thuộc danh mục: <strong>{title}</strong>
        </p>

        <div className="price-filter-bar">
          <select
            className="price-filter-select"
            value={priceFilter}
            onChange={(e) => setPriceFilter(e.target.value)}
          >
            <option value="all">LỌC THEO GIÁ</option>
            <option value="under-1000">Dưới 1.000.000 đ</option>
            <option value="1000-2000">Từ 1.000.000 đ - 2.000.000 đ</option>
            <option value="2000-3000">Từ 2.000.000 đ - 3.000.000 đ</option>
            <option value="over-3000">Trên 3.000.000 đ</option>
          </select>

          <button className="price-filter-btn" type="button">
            BỘ LỌC
          </button>
        </div>

        {loadingDb ? (
          <p className="no-products-text">Đang tải sản phẩm...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="no-products-text">
            Không có sản phẩm phù hợp với danh mục hoặc mức giá này.
          </p>
        ) : (
          <div className="home-product-grid">
            {filteredProducts.map((item) => {
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
                        e.target.src =
                          'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=500&q=80';
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
      </div>

      <InformComponent />
    </div>
  );
}

export default CategoryPageComponent;