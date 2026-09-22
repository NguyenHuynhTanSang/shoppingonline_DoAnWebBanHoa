import React, {
  useState,
  useEffect,
  useMemo,
  useCallback
} from 'react';

import {
  useSearchParams,
  Link,
  useNavigate
} from 'react-router-dom';

import API from '../services/api';

import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';
import PriceFilter from './PriceFilter';

function normalizeText(value = '') {
  return String(value)
    .trim()
    .toLowerCase();
}

function toSlug(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9\s-]/g,
      ''
    )
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatMoney(value) {
  return Number(
    value || 0
  ).toLocaleString('vi-VN');
}

function getImageSrc(image) {
  const value =
    String(image || '').trim();

  if (!value) return '';

  if (
    value.startsWith('data:image')
  ) {
    return value;
  }

  if (
    value.startsWith('http://') ||
    value.startsWith('https://')
  ) {
    return value;
  }

  if (
    value.startsWith('/') ||
    value.startsWith('./')
  ) {
    return value;
  }

  return `data:image/jpg;base64,${value}`;
}

function getCategoryName(product) {
  if (!product) return '';

  if (
    typeof product.category ===
    'string'
  ) {
    return product.category;
  }

  return product.category?.name || '';
}

function getSubmenuName(product) {
  if (!product) return '';

  if (
    typeof product.submenu ===
    'string'
  ) {
    return product.submenu;
  }

  return product.submenu?.name || '';
}

function getCategorySlug(product) {
  if (!product) return '';

  if (
    typeof product.category ===
      'object' &&
    product.category?.slug
  ) {
    return normalizeText(
      product.category.slug
    );
  }

  if (product.categorySlug) {
    return normalizeText(
      product.categorySlug
    );
  }

  return toSlug(
    getCategoryName(product)
  );
}

function getSubmenuSlug(product) {
  if (!product) return '';

  if (
    typeof product.submenu ===
      'object' &&
    product.submenu?.slug
  ) {
    return normalizeText(
      product.submenu.slug
    );
  }

  return toSlug(
    getSubmenuName(product)
  );
}

function getSlugAliases(slug) {
  const normalized =
    normalizeText(slug);

  const aliasMap = {
    'bo-hoa-8-3': [
      'bo-hoa-8-3',
      'bo-hoa'
    ],

    'gio-hoa-8-3': [
      'gio-hoa-8-3',
      'gio-hoa'
    ],

    'binh-hoa-8-3': [
      'binh-hoa-8-3',
      'binh-hoa'
    ],

    tulip: [
      'tulip',
      'hoa-tulip'
    ],

    'hoa-tulip': [
      'tulip',
      'hoa-tulip'
    ],

    'tang-me': [
      'tang-me',
      'hoa-tang-me'
    ],

    'hoa-tang-me': [
      'tang-me',
      'hoa-tang-me'
    ]
  };

  return (
    aliasMap[normalized] ||
    [normalized]
  );
}

function matchesCategory(
  product,
  category
) {
  const normalizedCategory =
    normalizeText(category);

  if (
    !normalizedCategory ||
    normalizedCategory === 'all'
  ) {
    return true;
  }

  const aliases =
    getSlugAliases(
      normalizedCategory
    );

  const categorySlug =
    getCategorySlug(product);

  const submenuSlug =
    getSubmenuSlug(product);

  const categoryNameSlug =
    toSlug(
      getCategoryName(product)
    );

  const submenuNameSlug =
    toSlug(
      getSubmenuName(product)
    );

  return (
    aliases.includes(
      categorySlug
    ) ||
    aliases.includes(
      submenuSlug
    ) ||
    aliases.includes(
      categoryNameSlug
    ) ||
    aliases.includes(
      submenuNameSlug
    )
  );
}

function buildStockInfo(product) {
  const stock =
    Number(
      product?.stock || 0
    );

  const isOutOfStock =
    stock <= 0;

  const isLowStock =
    stock > 0 &&
    stock <= 5;

  if (isOutOfStock) {
    return {
      stock,
      isOutOfStock: true,
      isLowStock: false,
      text: 'Hết hàng',
      className:
        'product-stock-badge stock-out'
    };
  }

  if (isLowStock) {
    return {
      stock,
      isOutOfStock: false,
      isLowStock: true,
      text:
        `Chỉ còn ${stock} sản phẩm`,
      className:
        'product-stock-badge stock-low'
    };
  }

  return {
    stock,
    isOutOfStock: false,
    isLowStock: false,
    text:
      `Còn ${stock} sản phẩm`,
    className:
      'product-stock-badge stock-in'
  };
}

function getPricingInfo(product) {
  const originalPrice =
    Number(
      product?.originalPrice ??
      product?.price ??
      0
    );

  let finalPrice =
    Number(
      product?.finalPrice ??
      product?.price ??
      0
    );

  const discountPercent =
    Math.max(
      0,
      Math.min(
        100,
        Number(
          product?.discountPercent ||
          0
        )
      )
    );

  const discountPrice =
    Math.max(
      0,
      Number(
        product?.discountPrice ||
        0
      )
    );

  if (!product?.finalPrice) {
    if (
      discountPrice > 0 &&
      discountPrice <
        originalPrice
    ) {
      finalPrice =
        Math.min(
          finalPrice,
          originalPrice -
            discountPrice
        );
    }

    if (
      discountPercent > 0
    ) {
      finalPrice =
        Math.min(
          finalPrice,
          Math.round(
            originalPrice *
              (
                100 -
                discountPercent
              ) /
              100
          )
        );
    }
  }

  finalPrice =
    Math.max(
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
      )
  };
}

function SearchPageComponent() {
  const [searchParams] =
    useSearchParams();

  const navigate =
    useNavigate();

  const [
    priceFilter,
    setPriceFilter
  ] = useState('all');

  const [
    dbProducts,
    setDbProducts
  ] = useState([]);

  const [
    loadingDb,
    setLoadingDb
  ] = useState(true);

  const [loadError, setLoadError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const keyword =
    (
      searchParams.get(
        'keyword'
      ) || ''
    )
      .trim()
      .toLowerCase();

  const category =
    (
      searchParams.get(
        'category'
      ) || 'all'
    )
      .trim()
      .toLowerCase();

  useEffect(() => {
    let cancelled = false;
    const fetchDbProducts =
      async () => {
        try {
          setLoadingDb(true);
          setLoadError(false);

          const res =
            await API.get(
              '/customer/all-products'
            );

          if (cancelled) return;
          if (!Array.isArray(res.data)) {
            throw new Error('Invalid product response');
          }
          setDbProducts(res.data);
        } catch (error) {
          if (cancelled) return;
          console.error('Product list could not be loaded');
          setLoadError(true);
          setDbProducts([]);
        } finally {
          if (!cancelled) setLoadingDb(false);
        }
      };

    fetchDbProducts();
    return () => { cancelled = true; };
  }, [keyword, category, retryAttempt]);

  const searchedProducts =
    useMemo(() => {
      return dbProducts.filter(
        item => {
          const id =
            String(
              item._id || ''
            ).toLowerCase();

          const name =
            normalizeText(
              item.name || ''
            );

          const categoryName =
            normalizeText(
              getCategoryName(
                item
              )
            );

          const submenuName =
            normalizeText(
              getSubmenuName(
                item
              )
            );

          const categorySlug =
            normalizeText(
              getCategorySlug(
                item
              )
            );

          const submenuSlug =
            normalizeText(
              getSubmenuSlug(
                item
              )
            );

          const description =
            normalizeText(
              item.description || ''
            );

          const matchKeyword =
            !keyword ||
            id.includes(
              keyword
            ) ||
            name.includes(
              keyword
            ) ||
            categoryName.includes(
              keyword
            ) ||
            submenuName.includes(
              keyword
            ) ||
            categorySlug.includes(
              keyword
            ) ||
            submenuSlug.includes(
              keyword
            ) ||
            description.includes(
              keyword
            );

          const matchCategory =
            matchesCategory(
              item,
              category
            );

          return (
            matchKeyword &&
            matchCategory
          );
        }
      );
    }, [
      dbProducts,
      keyword,
      category
    ]);

  const filterByPrice =
    useCallback(
      items => {
        switch (
          priceFilter
        ) {
          case 'under-1000':
            return items.filter(
              item =>
                Number(
                  getPricingInfo(
                    item
                  ).finalPrice ||
                    0
                ) <
                1000000
            );

          case '1000-2000':
            return items.filter(
              item => {
                const price =
                  Number(
                    getPricingInfo(
                      item
                    ).finalPrice ||
                      0
                  );

                return (
                  price >=
                    1000000 &&
                  price <=
                    2000000
                );
              }
            );

          case '2000-3000':
            return items.filter(
              item => {
                const price =
                  Number(
                    getPricingInfo(
                      item
                    ).finalPrice ||
                      0
                  );

                return (
                  price >
                    2000000 &&
                  price <=
                    3000000
                );
              }
            );

          case 'over-3000':
            return items.filter(
              item =>
                Number(
                  getPricingInfo(
                    item
                  ).finalPrice ||
                    0
                ) >
                3000000
            );

          default:
            return items;
        }
      },
      [priceFilter]
    );

  const productsFound =
    useMemo(() => {
      return filterByPrice(
        searchedProducts
      );
    }, [
      searchedProducts,
      filterByPrice
    ]);

  const addToCart =
    product => {
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

        return;
      }

      if (
        !product ||
        !product._id
      ) {
        alert(
          'Không tìm thấy sản phẩm trong MongoDB.'
        );

        return;
      }

      const stock =
        Number(
          product.stock || 0
        );

      if (stock <= 0) {
        alert(
          'Sản phẩm hiện đã hết hàng.'
        );

        return;
      }

      const pricing =
        getPricingInfo(
          product
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
            product._id
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
            `Sản phẩm "${product.name}" chỉ còn ${stock} trong kho`
          );

          return;
        }

        cart[index].quantity =
          nextQty;

        cart[index].price =
          Number(
            pricing.finalPrice ||
              0
          );

        cart[index].originalPrice =
          Number(
            pricing.originalPrice ||
              0
          );

        cart[index].discountPercent =
          Number(
            product.discountPercent ||
              0
          );

        cart[index].discountPrice =
          Number(
            product.discountPrice ||
              0
          );
      } else {
        cart.push({
          _id:
            product._id,

          name:
            product.name,

          image:
            getImageSrc(
              product.image
            ),

          price:
            Number(
              pricing.finalPrice ||
                0
            ),

          originalPrice:
            Number(
              pricing.originalPrice ||
                0
            ),

          discountPercent:
            Number(
              product.discountPercent ||
                0
            ),

          discountPrice:
            Number(
              product.discountPrice ||
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

      alert(
        'Đã thêm vào giỏ hàng!'
      );

      window.location.reload();
    };

  return (
    <div>
      <MenuComponent />

      <main className="wf-search-page">
        <header className="wf-search-heading">
          <h1 className="wf-search-title">
            Kết quả tìm kiếm
          </h1>

          <p className="wf-search-description">
            Từ khóa:{' '}
            <strong>
              {keyword ||
                'Tất cả'}
            </strong>

            <br />

            Danh mục:{' '}
            <strong>
              {category ===
              'all'
                ? 'Tất cả'
                : category}
            </strong>
          </p>
        </header>

        <div className="wf-search-filter-wrap">
          <PriceFilter
            value={
              priceFilter
            }
            onChange={
              setPriceFilter
            }
          />
        </div>

        {loadingDb ? (
          <p className="wf-search-status">
            Đang tải sản phẩm...
          </p>
        ) : loadError ? (
          <div className="wf-search-status" role="alert">
            <h2>Không thể tải kết quả tìm kiếm</h2>
            <p>Vui lòng thử lại sau.</p>
            <button
              type="button"
              className="wf-orders-empty-button"
              onClick={() => setRetryAttempt(value => value + 1)}
            >
              Thử lại
            </button>
          </div>
        ) : productsFound.length ===
          0 ? (
          <p className="wf-search-status">
            Không tìm thấy sản phẩm phù hợp.
          </p>
        ) : (
          <div className="wf-search-grid">
            {productsFound.map(
              item => {
                const stockInfo =
                  buildStockInfo(
                    item
                  );

                const pricing =
                  getPricingInfo(
                    item
                  );

                return (
                  <article
                    className="wf-product-card"
                    key={
                      item._id
                    }
                  >
                    <Link
                      to={`/product/${item._id}`}
                      className="wf-product-card-image-link"
                    >
                      <img
                        className="wf-product-card-image"
                        src={
                          getImageSrc(
                            item.image
                          )
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

                    <h3 className="wf-product-card-name">
                      {item.name}
                    </h3>

                    <div className="wf-product-card-price-box">
                      {pricing.hasDiscount ? (
                        <>
                          <p className="wf-product-card-original-price">
                            {formatMoney(
                              pricing.originalPrice
                            )}{' '}
                            đ
                          </p>

                          <p className="wf-product-card-price">
                            {formatMoney(
                              pricing.finalPrice
                            )}{' '}
                            đ
                          </p>
                        </>
                      ) : (
                        <p className="wf-product-card-price">
                          {formatMoney(
                            pricing.originalPrice
                          )}{' '}
                          đ
                        </p>
                      )}
                    </div>

                    <div className="wf-product-card-stock">
                      <span
                        className={
                          stockInfo.className
                        }
                      >
                        {
                          stockInfo.text
                        }
                      </span>
                    </div>

                    <div className="wf-product-card-actions">
                      <button
                        type="button"
                        onClick={() =>
                          addToCart(
                            item
                          )
                        }
                        disabled={
                          stockInfo.isOutOfStock
                        }
                      >
                        {stockInfo.isOutOfStock
                          ? 'Hết hàng'
                          : 'Thêm vào giỏ'}
                      </button>

                      <button
                        type="button"
                        className="wf-product-detail-btn"
                        onClick={() =>
                          navigate(
                            `/product/${item._id}`
                          )
                        }
                      >
                        Xem chi tiết
                      </button>
                    </div>
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

export default SearchPageComponent;