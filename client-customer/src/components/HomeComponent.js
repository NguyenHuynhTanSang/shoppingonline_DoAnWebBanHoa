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

function normalizeText(value = '') {
  return String(value)
    .trim()
    .toLowerCase();
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

  if (value.startsWith('data:image')) {
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

function getCategorySlug(product) {
  if (!product) return '';

  if (
    typeof product.category ===
    'string'
  ) {
    return '';
  }

  return (
    product.category?.slug ||
    product.categorySlug ||
    ''
  );
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
          product?.discountPercent || 0
        )
      )
    );

  const discountPrice =
    Math.max(
      0,
      Number(
        product?.discountPrice || 0
      )
    );

  if (!product?.finalPrice) {
    if (
      discountPrice > 0 &&
      discountPrice < originalPrice
    ) {
      finalPrice =
        Math.min(
          finalPrice,
          originalPrice - discountPrice
        );
    }

    if (discountPercent > 0) {
      finalPrice =
        Math.min(
          finalPrice,
          Math.round(
            originalPrice *
              (100 - discountPercent) /
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
      finalPrice < originalPrice,

    savedAmount:
      Math.max(
        0,
        originalPrice - finalPrice
      )
  };
}

function belongsToCategory(
  product,
  categoryKey
) {
  const categoryName =
    normalizeText(
      getCategoryName(product)
    );

  const categorySlug =
    normalizeText(
      getCategorySlug(product)
    );

  const submenuName =
    normalizeText(
      getSubmenuName(product)
    );

  const submenuSlug =
    normalizeText(
      getSubmenuSlug(product)
    );

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

function HomeComponent() {
  const [cartFeedback, setCartFeedback] = useState(0);

  useEffect(() => {
    if (!cartFeedback) return;
    const timeout = setTimeout(() => setCartFeedback(0), 3000);
    return () => clearTimeout(timeout);
  }, [cartFeedback]);

  const navigate =
    useNavigate();

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

  const [
    activeSlide,
    setActiveSlide
  ] = useState(0);

  const [
    carouselPaused,
    setCarouselPaused
  ] = useState(false);

  const touchStartX =
    useRef(null);

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
  }, [retryAttempt]);

  const bouquetProducts =
    useMemo(() => {
      return dbProducts
        .filter(item =>
          belongsToCategory(
            item,
            'bo-hoa-8-3'
          )
        )
        .slice(0, 5);
    }, [dbProducts]);

  const basketProducts =
    useMemo(() => {
      return dbProducts
        .filter(item =>
          belongsToCategory(
            item,
            'gio-hoa-8-3'
          )
        )
        .slice(0, 5);
    }, [dbProducts]);

  const vaseProducts =
    useMemo(() => {
      return dbProducts
        .filter(item =>
          belongsToCategory(
            item,
            'binh-hoa-8-3'
          )
        )
        .slice(0, 5);
    }, [dbProducts]);

  const tulipProducts =
    useMemo(() => {
      return dbProducts
        .filter(item =>
          belongsToCategory(
            item,
            'tulip'
          )
        )
        .slice(0, 5);
    }, [dbProducts]);

  const tangMeProducts =
    useMemo(() => {
      return dbProducts
        .filter(item =>
          belongsToCategory(
            item,
            'hoa-tang-me'
          )
        )
        .slice(0, 5);
    }, [dbProducts]);

  const tulipLink =
    useMemo(() => {
      const first =
        tulipProducts[0];

      const slug =
        first?.category?.slug ||
        first?.submenu?.slug ||
        'tulip';

      return `/category/${slug}`;
    }, [tulipProducts]);

  const tangMeLink =
    useMemo(() => {
      const first =
        tangMeProducts[0];

      const slug =
        first?.category?.slug ||
        first?.submenu?.slug ||
        'hoa-tang-me';

      return `/category/${slug}`;
    }, [tangMeProducts]);

  /*
   * =====================================================
   * HERO CAROUSEL
   *
   * 5 banner nằm trong:
   * public/images/banners/
   *
   * Không gọi API.
   * Không dependency ngoài.
   * =====================================================
   */

  const heroSlides =
    useMemo(
      () => [
        {
          id: 1,

          image:
            '/images/banners/windflower-01.png',

          alt:
            'Wind Flower - Gửi hoa gửi yêu thương',

          link:
            '/category/bo-hoa-8-3',

          label:
            'Gửi hoa, gửi yêu thương'
        },

        {
          id: 2,

          image:
            '/images/banners/windflower-02-birthday.png',

          alt:
            'Wind Flower - Hoa sinh nhật',

          link:
            '/search?keyword=sinh%20nh%E1%BA%ADt',

          label:
            'Hoa sinh nhật'
        },

        {
          id: 3,

          image:
            '/images/banners/windflower-03-love.png',

          alt:
            'Wind Flower - Hoa tình yêu',

          link:
            '/search?keyword=hoa%20h%E1%BB%93ng',

          label:
            'Hoa tình yêu'
        },

        {
          id: 4,

          image:
            '/images/banners/windflower-04-congrats.png',

          alt:
            'Wind Flower - Hoa chúc mừng',

          link:
            '/search?keyword=ch%C3%BAc%20m%E1%BB%ABng',

          label:
            'Hoa chúc mừng'
        },

        {
          id: 5,

          image:
            '/images/banners/windflower-05-tulip.png',

          alt:
            'Wind Flower - Hoa tulip',

          link:
            tulipLink,

          label:
            'Hoa tulip'
        }
      ],
      [tulipLink]
    );

  /*
   * Preload banner để lúc chuyển slide
   * hạn chế bị nháy trắng.
   */
  useEffect(() => {
    heroSlides.forEach(
      slide => {
        const image =
          new Image();

        image.src =
          slide.image;
      }
    );
  }, [heroSlides]);

  /*
   * Tự chuyển mỗi 4.5 giây.
   *
   * Nếu user bật Reduce Motion trong OS
   * thì không tự chạy.
   */
  useEffect(() => {
    if (
      carouselPaused ||
      heroSlides.length <= 1
    ) {
      return undefined;
    }

    if (
      window.matchMedia &&
      window
        .matchMedia(
          '(prefers-reduced-motion: reduce)'
        )
        .matches
    ) {
      return undefined;
    }

    const timer =
      window.setInterval(
        () => {
          setActiveSlide(
            current =>
              (
                current + 1
              ) %
              heroSlides.length
          );
        },
        4500
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    carouselPaused,
    heroSlides.length
  ]);

  const showPreviousSlide =
    () => {
      setActiveSlide(
        current =>
          (
            current -
            1 +
            heroSlides.length
          ) %
          heroSlides.length
      );
    };

  const showNextSlide =
    () => {
      setActiveSlide(
        current =>
          (
            current + 1
          ) %
          heroSlides.length
      );
    };

  const handleTouchStart =
    event => {
      touchStartX.current =
        event.touches?.[0]
          ?.clientX ??
        null;
    };

  const handleTouchEnd =
    event => {
      if (
        touchStartX.current ===
        null
      ) {
        return;
      }

      const touchEndX =
        event.changedTouches?.[0]
          ?.clientX;

      if (
        typeof touchEndX !==
        'number'
      ) {
        touchStartX.current =
          null;

        return;
      }

      const distance =
        touchStartX.current -
        touchEndX;

      touchStartX.current =
        null;

      if (
        Math.abs(distance) <
        45
      ) {
        return;
      }

      if (distance > 0) {
        showNextSlide();
      } else {
        showPreviousSlide();
      }
    };

  const handleCarouselBlur =
    event => {
      if (
        !event.currentTarget.contains(
          event.relatedTarget
        )
      ) {
        setCarouselPaused(
          false
        );
      }
    };

  const categories =
    useMemo(() => {
      return [
        {
          id: 1,

          name: 'Giỏ hoa',

          image:
            '/images/gio-hoa.png',

          link:
            '/category/gio-hoa-8-3'
        },

        {
          id: 2,

          name: 'Bó hoa',

          image:
            '/images/bo-hoa.png',

          link:
            '/category/bo-hoa-8-3'
        },

        {
          id: 3,

          name: 'Bình hoa',

          image:
            '/images/binh-hoa.png',

          link:
            '/category/binh-hoa-8-3'
        },

        {
          id: 4,

          name: 'Tulip',

          image:
            '/images/tulip.png',

          link:
            tulipLink
        },

        {
          id: 5,

          name: 'Hoa tặng mẹ',

          image:
            '/images/me.png',

          link:
            tangMeLink
        }
      ];
    }, [
      tulipLink,
      tangMeLink
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
            pricing.finalPrice || 0
          );

        cart[index].originalPrice =
          Number(
            pricing.originalPrice || 0
          );

        cart[index].discountPercent =
          Number(
            product.discountPercent || 0
          );

        cart[index].discountPrice =
          Number(
            product.discountPrice || 0
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
              pricing.finalPrice || 0
            ),

          originalPrice:
            Number(
              pricing.originalPrice || 0
            ),

          discountPercent:
            Number(
              product.discountPercent || 0
            ),

          discountPrice:
            Number(
              product.discountPrice || 0
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
      setCartFeedback(value => value + 1);
    };

  const reviews = [
    {
      id: 1,

      name:
        'Anh Hoàng - Quận 2',

      content:
        'Đặt hoa cho người thân rất đẹp, giao đúng giờ và đóng gói cẩn thận.',

      image:
        '/images/gio-hoa.png'
    },

    {
      id: 2,

      name:
        'Chị Ngọc Lan - Phú Nhuận',

      content:
        'Lần đầu đặt mà rất hài lòng. Hoa tươi, đúng mẫu và tư vấn dễ thương.',

      image:
        '/images/bo-hoa-tulip-hong-sang-trong-thanh-lich.png'
    },

    {
      id: 3,

      name:
        'Anh Tú - Quận 7',

      content:
        'Dịch vụ nhanh, giao đẹp, sẽ tiếp tục ủng hộ shop trong những dịp sau.',

      image:
        '/images/bo-tulip-cam.png'
    },

    {
      id: 4,

      name:
        'Bạn Hoài Thương - Q5',

      content:
        'Mình đặt qua website rất tiện. Giá ổn, mẫu hoa nhìn sang và đẹp.',

      image:
        '/images/binh-hoa-huong-duong.png'
    }
  ];

  const renderProductSection =
    (
      title,
      slug,
      items
    ) => (
      <section className="home-product-section">
        <div className="section-head">
          <h2>
            {title}
          </h2>

          <Link
            to={slug}
            className="section-more-btn"
          >
            XEM THÊM
          </Link>
        </div>

        {loadingDb ? (
          <p className="no-products-text">
            Đang tải sản phẩm...
          </p>
        ) : loadError ? (
          <div className="no-products-text" role="alert">
            <p>Không thể tải sản phẩm. Vui lòng thử lại sau.</p>
            <button
              type="button"
              className="section-more-btn"
              onClick={() => setRetryAttempt(value => value + 1)}
            >
              Thử lại
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="no-products-text">
            Chưa có sản phẩm trong danh mục này.
          </p>
        ) : (
          <div className="home-product-grid">
            {items.map(
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
                    key={item._id}
                  >
                    <Link
                      to={`/product/${item._id}`}
                      className="wf-product-card-image-link"
                    >
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
                              '/images/tang-hoa.png';
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
      </section>
    );

  const currentSlide =
    heroSlides[
      activeSlide
    ];

  return (
    <div className="home-page wind-home-page">
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

      <div className="container">
        <section
          className="home-banner-section wind-home-hero-section"
          aria-label="Banner nổi bật Wind Flower"
        >
          <div
            className="wind-home-carousel"
            onMouseEnter={() =>
              setCarouselPaused(
                true
              )
            }
            onMouseLeave={() =>
              setCarouselPaused(
                false
              )
            }
            onFocusCapture={() =>
              setCarouselPaused(
                true
              )
            }
            onBlurCapture={
              handleCarouselBlur
            }
            onTouchStart={
              handleTouchStart
            }
            onTouchEnd={
              handleTouchEnd
            }
          >
            <Link
              key={
                currentSlide.id
              }
              to={
                currentSlide.link
              }
              className="wind-home-carousel-slide"
              aria-label={
                currentSlide.label
              }
            >
              <img
                className="wind-home-carousel-image"
                src={
                  currentSlide.image
                }
                alt={
                  currentSlide.alt
                }
                loading={
                  activeSlide === 0
                    ? 'eager'
                    : 'lazy'
                }
                onError={
                  event => {
                    event.currentTarget.src =
                      'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?auto=format&fit=crop&w=1600&q=80';
                  }
                }
              />
            </Link>

            <button
              type="button"
              className="wind-home-carousel-arrow wind-home-carousel-arrow-left"
              onClick={
                showPreviousSlide
              }
              aria-label="Banner trước"
            >
              ‹
            </button>

            <button
              type="button"
              className="wind-home-carousel-arrow wind-home-carousel-arrow-right"
              onClick={
                showNextSlide
              }
              aria-label="Banner tiếp theo"
            >
              ›
            </button>

            <div
              className="wind-home-carousel-dots"
              aria-label="Chọn banner"
            >
              {heroSlides.map(
                (
                  slide,
                  index
                ) => (
                  <button
                    type="button"
                    key={
                      slide.id
                    }
                    className={
                      index ===
                      activeSlide
                        ? 'wind-home-carousel-dot active'
                        : 'wind-home-carousel-dot'
                    }
                    onClick={() =>
                      setActiveSlide(
                        index
                      )
                    }
                    aria-label={
                      `Chuyển đến banner ${index + 1}: ${slide.label}`
                    }
                    aria-current={
                      index ===
                      activeSlide
                        ? 'true'
                        : undefined
                    }
                  />
                )
              )}
            </div>
          </div>
        </section>

        <section className="home-round-category-section wind-home-category-section">
          <div className="wind-home-category-heading">
            <span>
              Khám phá nhanh
            </span>

            <h2>
              Chọn hoa theo nhu cầu
            </h2>
          </div>

          <div className="home-round-category-list wind-home-category-list">
            {categories.map(
              item => (
                <Link
                  to={
                    item.link
                  }
                  className="home-round-category-item wind-home-category-item"
                  key={
                    item.id
                  }
                >
                  <div className="wind-home-category-image-wrap">
                    <img
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
                            '/images/tang-hoa.png';
                        }
                      }
                    />
                  </div>

                  <p>
                    {item.name}
                  </p>
                </Link>
              )
            )}
          </div>
        </section>

        {renderProductSection(
          'Bó Hoa Tặng 8-3',
          '/category/bo-hoa-8-3',
          bouquetProducts
        )}

        {renderProductSection(
          'Giỏ Hoa Tặng 8-3',
          '/category/gio-hoa-8-3',
          basketProducts
        )}

        {renderProductSection(
          'Bình Hoa Cao Cấp 8-3',
          '/category/binh-hoa-8-3',
          vaseProducts
        )}

        {renderProductSection(
          'Hoa Tulip Tặng 8-3',
          tulipLink,
          tulipProducts
        )}

        <section className="review-section">
          <h2>
            Đánh Giá
          </h2>

          <div className="review-grid">
            {reviews.map(
              item => (
                <div
                  className="review-card"
                  key={
                    item.id
                  }
                >
                  <div className="review-image">
                    <img
                      src={
                        item.image
                      }
                      alt={
                        item.name
                      }
                      loading="lazy"
                    />
                  </div>

                  <div className="review-content">
                    <p>
                      {
                        item.content
                      }
                    </p>

                    <span>
                      {
                        item.name
                      }
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default HomeComponent;