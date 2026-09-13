import React, {
  useCallback,
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

import { FiShoppingBag } from 'react-icons/fi';

import {
  FaBars,
  FaChevronDown,
  FaTimes
} from 'react-icons/fa';


const FALLBACK_CATEGORIES = [
  {
    name: 'Kiểu dáng',
    slug: 'kieu-dang',
    submenus: [
      {
        name: 'Bó hoa 8-3',
        slug: 'bo-hoa-8-3'
      },
      {
        name: 'Bình hoa 8-3',
        slug: 'binh-hoa-8-3'
      },
      {
        name: 'Giỏ hoa 8-3',
        slug: 'gio-hoa-8-3'
      }
    ]
  },

  {
    name: 'Loại hoa',
    slug: 'loai-hoa',
    submenus: [
      {
        name: 'Hoa hồng',
        slug: 'hoa-hong'
      },
      {
        name: 'Hoa hướng dương',
        slug: 'hoa-huong-duong'
      },
      {
        name: 'Hoa cát tường',
        slug: 'hoa-cat-tuong'
      },
      {
        name: 'Hoa lan hồ điệp',
        slug: 'hoa-lan-ho-diep'
      }
    ]
  },

  {
    name: 'Loại hoa đặc biệt',
    slug: 'loai-hoa-dac-biet',
    submenus: [
      {
        name: 'Hoa tulip',
        slug: 'tulip'
      }
    ]
  }
];

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

function normalizeCategories(data = []) {
  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    return FALLBACK_CATEGORIES;
  }

  return data.map((cat) => ({
    _id: cat._id,

    name:
      cat.name || '',

    slug:
      cat.slug ||
      toSlug(cat.name || ''),

    submenus:
      Array.isArray(cat.submenus)
        ? cat.submenus
            .filter(
              submenu =>
                submenu &&
                submenu.name
            )
            .map(submenu => ({
              _id:
                submenu._id,

              name:
                submenu.name || '',

              slug:
                submenu.slug ||
                toSlug(
                  submenu.name || ''
                )
            }))
        : []
  }));
}

function getCategoryPath(item) {
  const slug =
    item?.slug ||
    toSlug(
      item?.name || ''
    );

  return `/category/${slug}`;
}

function MenuComponent() {
  const [
    customer,
    setCustomer
  ] = useState(null);

  const [
    cartCount,
    setCartCount
  ] = useState(0);

  const [
    cartTotal,
    setCartTotal
  ] = useState(0);

  // =========================
  // Desktop menus
  // =========================

  const [
    showCategoryMenu,
    setShowCategoryMenu
  ] = useState(false);

  const [
    showStyleMenu,
    setShowStyleMenu
  ] = useState(false);

  const [
    showFlowerTypeMenu,
    setShowFlowerTypeMenu
  ] = useState(false);

  const [
    showProfilePopup,
    setShowProfilePopup
  ] = useState(false);

  // =========================
  // Mobile menus
  // =========================

  const [
    showMobileMenu,
    setShowMobileMenu
  ] = useState(false);

  const [
    showMobileCategories,
    setShowMobileCategories
  ] = useState(false);

  const [
    showMobileStyles,
    setShowMobileStyles
  ] = useState(false);

  const [
    showMobileFlowerTypes,
    setShowMobileFlowerTypes
  ] = useState(false);

  // =========================
  // Search / category data
  // =========================

  const [
    keyword,
    setKeyword
  ] = useState('');

  const [
    selectedCategory,
    setSelectedCategory
  ] = useState('all');

  const [
    dbCategories,
    setDbCategories
  ] = useState([]);

  const [
    loadingCategories,
    setLoadingCategories
  ] = useState(true);

  const navigate =
    useNavigate();

  const forcedLogoutRef =
    useRef(false);

  const profileRef =
    useRef(null);

  // =========================
  // Customer session
  // =========================

  const clearCustomerSession =
    useCallback(() => {
      localStorage.removeItem(
        'customer'
      );

      localStorage.removeItem(
        'customerToken'
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

      setCustomer(null);
    }, []);

  const forceLogout =
    useCallback(
      (
        message,
        redirectTo = '/login'
      ) => {
        if (
          forcedLogoutRef.current
        ) {
          return;
        }

        forcedLogoutRef.current =
          true;

        clearCustomerSession();

        if (message) {
          alert(message);
        }

        navigate(
          redirectTo,
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

  // =========================
  // Cart
  // =========================

  const refreshCart =
    useCallback(() => {
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
          'READ CART LOCALSTORAGE ERROR:',
          error
        );

        cart = [];
      }

      const totalQty =
        cart.reduce(
          (
            sum,
            item
          ) =>
            sum +
            Number(
              item.quantity || 0
            ),

          0
        );

      const totalPrice =
        cart.reduce(
          (
            sum,
            item
          ) =>
            sum +
            Number(
              item.price || 0
            ) *
              Number(
                item.quantity || 0
              ),

          0
        );

      setCartCount(
        totalQty
      );

      setCartTotal(
        totalPrice
      );
    }, []);

  // =========================
  // Check session
  // =========================

  const checkCustomerSession =
    useCallback(async () => {
      const token =
        localStorage.getItem(
          'customerToken'
        );

      if (!token) {
        return;
      }

      try {
        const res =
          await API.get(
            '/customer/session',
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );

        if (
          res.data?.success &&
          res.data?.customer
        ) {
          const freshCustomer =
            res.data.customer;

          setCustomer(
            freshCustomer
          );

          localStorage.setItem(
            'customer',
            JSON.stringify(
              freshCustomer
            )
          );
        }
      } catch (error) {
        console.error(
          'CHECK CUSTOMER SESSION ERROR:',
          error
        );

        const status =
          error.response?.status;

        const code =
          error.response?.data?.code;

        const message =
          error.response?.data
            ?.message || '';

        if (
          status === 403 &&
          code ===
            'ACCOUNT_LOCKED'
        ) {
          forceLogout(
            'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.'
          );

          return;
        }

        if (
          status === 403 &&
          code ===
            'ACCOUNT_INACTIVE'
        ) {
          forceLogout(
            'Tài khoản của bạn chưa được kích hoạt.'
          );

          return;
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
        }
      }
    }, [forceLogout]);

  // =========================
  // Initial customer/cart
  // =========================

  useEffect(() => {
    try {
      const storedCustomer =
        localStorage.getItem(
          'customer'
        );

      if (storedCustomer) {
        setCustomer(
          JSON.parse(
            storedCustomer
          )
        );
      }
    } catch (error) {
      console.error(
        'READ CUSTOMER LOCALSTORAGE ERROR:',
        error
      );

      localStorage.removeItem(
        'customer'
      );

      setCustomer(null);
    }

    refreshCart();

    window.addEventListener(
      'storage',
      refreshCart
    );

    window.addEventListener(
      'focus',
      checkCustomerSession
    );

    const intervalId =
      setInterval(() => {
        checkCustomerSession();
      }, 10000);

    checkCustomerSession();

    return () => {
      window.removeEventListener(
        'storage',
        refreshCart
      );

      window.removeEventListener(
        'focus',
        checkCustomerSession
      );

      clearInterval(
        intervalId
      );
    };
  }, [
    refreshCart,
    checkCustomerSession
  ]);

  // =========================
  // Desktop profile outside click
  // =========================

  useEffect(() => {
    const handleClickOutside =
      event => {
        if (
          profileRef.current &&
          !profileRef.current.contains(
            event.target
          )
        ) {
          setShowProfilePopup(
            false
          );
        }
      };

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, []);

  // =========================
  // Close mobile menu when
  // browser becomes desktop
  // =========================

  useEffect(() => {
    const handleResize = () => {
      if (
        window.innerWidth > 1024
      ) {
        setShowMobileMenu(
          false
        );

        setShowMobileCategories(
          false
        );

        setShowMobileStyles(
          false
        );

        setShowMobileFlowerTypes(
          false
        );
      }
    };

    window.addEventListener(
      'resize',
      handleResize
    );

    return () => {
      window.removeEventListener(
        'resize',
        handleResize
      );
    };
  }, []);

  // =========================
  // Categories
  // =========================

  useEffect(() => {
    const fetchCategories =
      async () => {
        try {
          setLoadingCategories(
            true
          );

          const res =
            await API.get(
              '/customer/categories'
            );

          setDbCategories(
            normalizeCategories(
              res.data || []
            )
          );
        } catch (error) {
          console.error(
            'Lỗi load categories từ DB:',
            error
          );

          setDbCategories(
            FALLBACK_CATEGORIES
          );
        } finally {
          setLoadingCategories(
            false
          );
        }
      };

    fetchCategories();
  }, []);

  const categories =
    useMemo(() => {
      return normalizeCategories(
        dbCategories
      );
    }, [dbCategories]);

  const flatItems =
    useMemo(() => {
      const items = [];

      categories.forEach(
        cat => {
          if (
            Array.isArray(
              cat.submenus
            ) &&
            cat.submenus.length > 0
          ) {
            cat.submenus.forEach(
              submenu => {
                items.push({
                  _id:
                    submenu._id ||
                    `${cat.slug}-${submenu.slug}`,

                  name:
                    submenu.name,

                  slug:
                    submenu.slug,

                  parentName:
                    cat.name,

                  parentSlug:
                    cat.slug
                });
              }
            );
          } else {
            items.push({
              _id:
                cat._id ||
                cat.slug,

              name:
                cat.name,

              slug:
                cat.slug,

              parentName: '',
              parentSlug: ''
            });
          }
        }
      );

      return items;
    }, [categories]);

  const uniqueItems =
    useMemo(() => {
      const map =
        new Map();

      flatItems.forEach(
        item => {
          if (
            !map.has(
              item.slug
            )
          ) {
            map.set(
              item.slug,
              item
            );
          }
        }
      );

      return Array.from(
        map.values()
      );
    }, [flatItems]);

  const styleItems =
    useMemo(() => {
      return uniqueItems.filter(
        item => {
          const name =
            normalizeText(
              item.name
            );

          const parent =
            normalizeText(
              item.parentName
            );

          const slug =
            normalizeText(
              item.slug
            );

          return (
            name.includes('8-3') ||
            slug.includes('8-3') ||
            parent ===
              'kiểu dáng'
          );
        }
      );
    }, [uniqueItems]);

  const flowerTypeItems =
    useMemo(() => {
      return uniqueItems.filter(
        item => {
          const name =
            normalizeText(
              item.name
            );

          const parent =
            normalizeText(
              item.parentName
            );

          return (
            parent ===
              'loại hoa' ||

            (
              name.startsWith(
                'hoa '
              ) &&

              !name.includes(
                '8-3'
              ) &&

              !name.includes(
                'tulip'
              ) &&

              !normalizeText(
                item.parentName
              ).includes(
                'đặc biệt'
              )
            )
          );
        }
      );
    }, [uniqueItems]);

  const specialItems =
    useMemo(() => {
      return uniqueItems.filter(
        item => {
          const name =
            normalizeText(
              item.name
            );

          const parent =
            normalizeText(
              item.parentName
            );

          return (
            parent.includes(
              'đặc biệt'
            ) ||
            name.includes(
              'tulip'
            ) ||
            name.includes(
              'đặc biệt'
            )
          );
        }
      );
    }, [uniqueItems]);

  const tulipItem =
    useMemo(() => {
      return (
        specialItems.find(
          item =>
            normalizeText(
              item.name
            ).includes(
              'tulip'
            )
        ) ||

        specialItems[0] ||

        null
      );
    }, [specialItems]);

  const searchOptions =
    useMemo(() => {
      const map =
        new Map();

      uniqueItems.forEach(
        item => {
          if (
            !map.has(
              item.slug
            )
          ) {
            map.set(
              item.slug,
              {
                label:
                  item.name,

                value:
                  item.slug
              }
            );
          }
        }
      );

      return Array.from(
        map.values()
      );
    }, [uniqueItems]);

  // =========================
  // Helpers
  // =========================

  const closeMobileMenu = () => {
    setShowMobileMenu(
      false
    );

    setShowMobileCategories(
      false
    );

    setShowMobileStyles(
      false
    );

    setShowMobileFlowerTypes(
      false
    );
  };

  const handleLogout = () => {
    clearCustomerSession();

    setShowProfilePopup(
      false
    );

    closeMobileMenu();

    navigate('/');

    window.location.reload();
  };

  const handleSearch = () => {
    const trimmedKeyword =
      keyword.trim();

    if (
      !trimmedKeyword &&
      selectedCategory ===
        'all'
    ) {
      alert(
        'Vui lòng nhập từ khóa hoặc chọn danh mục'
      );

      return;
    }

    const params =
      new URLSearchParams();

    if (trimmedKeyword) {
      params.set(
        'keyword',
        trimmedKeyword
      );
    }

    if (
      selectedCategory !==
      'all'
    ) {
      params.set(
        'category',
        selectedCategory
      );
    }

    closeMobileMenu();

    navigate(
      `/search?${params.toString()}`
    );
  };

  const handleKeyDownSearch =
    e => {
      if (
        e.key === 'Enter'
      ) {
        e.preventDefault();

        handleSearch();
      }
    };

  const renderSubmenuLinks =
    (
      submenus = [],
      onClick
    ) => {
      return submenus.map(
        submenu => (
          <Link
            key={
              submenu._id ||
              submenu.slug
            }
            to={
              getCategoryPath(
                submenu
              )
            }
            onClick={
              onClick
            }
          >
            {submenu.name}
          </Link>
        )
      );
    };

  const renderCategoryBlock =
    category => {
      const hasSubmenus =
        Array.isArray(
          category.submenus
        ) &&
        category.submenus.length >
          0;

      if (!hasSubmenus) {
        return (
          <Link
            key={
              category._id ||
              category.slug
            }
            to={
              getCategoryPath(
                category
              )
            }
            className="category-dropdown-single-link"
          >
            {category.name}
          </Link>
        );
      }

      return (
        <div
          className="category-dropdown-section"
          key={
            category._id ||
            category.slug
          }
        >
          <Link
            to={
              getCategoryPath(
                category
              )
            }
            className="category-dropdown-title category-dropdown-title-link"
          >
            {category.name}
          </Link>

          <div className="category-dropdown-links">
            {renderSubmenuLinks(
              category.submenus
            )}
          </div>
        </div>
      );
    };

  const displayName =
    customer?.name ||
    customer?.username ||
    'Khách hàng';

  const avatarLetter =
    displayName
      .charAt(0)
      .toUpperCase();

  // =========================
  // Render
  // =========================

  return (
    <div>
      {/* =================================================
          DESKTOP HEADER
      ================================================= */}

      <div className="desktop-header-shell">
        <div className="top-header">
          <div className="container top-header-inner">
            <Link
              to="/"
              className="brand wf-header-brand"
            >
              <img
                src="/images/windflower-logo.png"
                alt="Wind Flower"
                className="wf-header-brand-image"
              />
            </Link>

            <div className="search-bar">
              <input
                type="text"
                placeholder="Tìm sản phẩm"
                value={keyword}
                onChange={
                  e =>
                    setKeyword(
                      e.target.value
                    )
                }
                onKeyDown={
                  handleKeyDownSearch
                }
              />

              <select
                value={
                  selectedCategory
                }
                onChange={
                  e =>
                    setSelectedCategory(
                      e.target.value
                    )
                }
              >
                <option value="all">
                  CHỌN DANH MỤC
                </option>

                {searchOptions.map(
                  item => (
                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {item.label}
                    </option>
                  )
                )}
              </select>

              <button
                type="button"
                onClick={
                  handleSearch
                }
              >
                Tìm
              </button>
            </div>

            <div className="header-actions">
              {customer ? (
                <>
                  <div
                    ref={
                      profileRef
                    }
                    style={{
                      position:
                        'relative'
                    }}
                  >
                    <button
                      type="button"
                      className="user-box"
                      onClick={() =>
                        setShowProfilePopup(
                          !showProfilePopup
                        )
                      }
                      style={
                        userBoxButtonStyle
                      }
                    >
                      <div className="user-avatar">
                        {
                          avatarLetter
                        }
                      </div>

                      <span className="user-name">
                        Xin chào,{' '}
                        {
                          displayName
                        }
                      </span>
                    </button>

                    {showProfilePopup && (
                      <div
                        style={
                          profilePopupStyle
                        }
                      >
                        <div
                          style={
                            profileHeaderStyle
                          }
                        >
                          <div
                            style={
                              profileAvatarLargeStyle
                            }
                          >
                            {
                              avatarLetter
                            }
                          </div>

                          <div
                            style={{
                              minWidth:
                                0
                            }}
                          >
                            <div
                              style={
                                profileNameStyle
                              }
                            >
                              {
                                displayName
                              }
                            </div>

                            <div
                              style={
                                profileSubTextStyle
                              }
                            >
                              {customer?.email ||
                                'Chưa có email'}
                            </div>
                          </div>
                        </div>

                        <div
                          style={
                            profileInfoBoxStyle
                          }
                        >
                          <div
                            style={
                              profileRowStyle
                            }
                          >
                            <span
                              style={
                                profileLabelStyle
                              }
                            >
                              Họ tên:
                            </span>

                            <span
                              style={
                                profileValueStyle
                              }
                            >
                              {customer?.name ||
                                '---'}
                            </span>
                          </div>

                          <div
                            style={
                              profileRowStyle
                            }
                          >
                            <span
                              style={
                                profileLabelStyle
                              }
                            >
                              Tài khoản:
                            </span>

                            <span
                              style={
                                profileValueStyle
                              }
                            >
                              {customer?.username ||
                                '---'}
                            </span>
                          </div>

                          <div
                            style={
                              profileRowStyle
                            }
                          >
                            <span
                              style={
                                profileLabelStyle
                              }
                            >
                              Email:
                            </span>

                            <span
                              style={
                                profileValueStyle
                              }
                            >
                              {customer?.email ||
                                '---'}
                            </span>
                          </div>

                          <div
                            style={{
                              ...profileRowStyle,

                              borderBottom:
                                'none'
                            }}
                          >
                            <span
                              style={
                                profileLabelStyle
                              }
                            >
                              SĐT:
                            </span>

                            <span
                              style={
                                profileValueStyle
                              }
                            >
                              {customer?.phone ||
                                '---'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Link
                    to="/my-orders"
                    className="my-orders-link"
                    onClick={() =>
                      setShowProfilePopup(
                        false
                      )
                    }
                  >
                    Đơn hàng của tôi
                  </Link>

                  <button
                    type="button"
                    className="logout-btn"
                    onClick={
                      handleLogout
                    }
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <Link to="/login">
                  Đăng nhập / Đăng ký
                </Link>
              )}

              <Link
                to="/cart"
                className="cart-wrap-link"
              >
                <div className="cart-icon-box">
                  <FiShoppingBag />

                  <span className="cart-count">
                    {cartCount}
                  </span>
                </div>

                <span className="cart-total-text">
                  {cartTotal.toLocaleString(
                    'vi-VN'
                  )}{' '}
                  đ
                </span>
              </Link>

              <div className="hotline">
                093.130.3836
              </div>
            </div>
          </div>
        </div>

        <div className="menu-bar">
          <div className="container menu-inner">
            <div
              className="menu-category dropdown-parent"
              onMouseEnter={() =>
                setShowCategoryMenu(
                  true
                )
              }
              onMouseLeave={() =>
                setShowCategoryMenu(
                  false
                )
              }
            >
              <span className="menu-category-left">
                <FaBars />
                Danh mục sản phẩm
              </span>

              <FaChevronDown />

              {showCategoryMenu && (
                <div className="dropdown-menu category-dropdown category-dropdown-dynamic">
                  <Link to="/">
                    Trang chủ
                  </Link>

                  {categories.map(
                    category =>
                      renderCategoryBlock(
                        category
                      )
                  )}

                  {loadingCategories && (
                    <div className="category-dropdown-loading">
                      Đang tải danh mục...
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link to="/">
              Trang chủ
            </Link>

            {styleItems.length >
              0 && (
              <div
                className="menu-link-dropdown"
                onMouseEnter={() =>
                  setShowStyleMenu(
                    true
                  )
                }
                onMouseLeave={() =>
                  setShowStyleMenu(
                    false
                  )
                }
              >
                <div className="menu-link-trigger">
                  Hoa tặng 8-3

                  <FaChevronDown className="mini-down" />
                </div>

                {showStyleMenu && (
                  <div className="dropdown-menu top-dropdown">
                    {styleItems.map(
                      item => (
                        <Link
                          key={
                            item._id ||
                            item.slug
                          }
                          to={
                            getCategoryPath(
                              item
                            )
                          }
                        >
                          {
                            item.name
                          }
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {flowerTypeItems.length >
              0 && (
              <div
                className="menu-link-dropdown"
                onMouseEnter={() =>
                  setShowFlowerTypeMenu(
                    true
                  )
                }
                onMouseLeave={() =>
                  setShowFlowerTypeMenu(
                    false
                  )
                }
              >
                <div className="menu-link-trigger">
                  Các loại hoa

                  <FaChevronDown className="mini-down" />
                </div>

                {showFlowerTypeMenu && (
                  <div className="dropdown-menu top-dropdown">
                    {flowerTypeItems.map(
                      item => (
                        <Link
                          key={
                            item._id ||
                            item.slug
                          }
                          to={
                            getCategoryPath(
                              item
                            )
                          }
                        >
                          {
                            item.name
                          }
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {tulipItem && (
              <Link
                to={
                  getCategoryPath(
                    tulipItem
                  )
                }
                className="menu-new-link"
              >
                {tulipItem.name}

                <span className="menu-badge-new">
                  NEW
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* =================================================
          MOBILE HEADER
      ================================================= */}

      <header className="mobile-header-shell">
        <div className="mobile-header-main">
          <div className="mobile-brand-row">
            <Link
              to="/"
              className="mobile-brand"
              onClick={
                closeMobileMenu
              }
            >
              <div className="mobile-brand-logo">
                FLOWER
              </div>

              <div className="mobile-brand-name">
                WIND FLOWER
              </div>
            </Link>

            <Link
              to="/cart"
              className="mobile-cart-link"
              onClick={
                closeMobileMenu
              }
              aria-label="Giỏ hàng"
            >
              <div className="mobile-cart-icon">
                <FiShoppingBag />

                {cartCount > 0 && (
                  <span className="mobile-cart-count">
                    {cartCount}
                  </span>
                )}
              </div>

              <span className="mobile-cart-total">
                {cartTotal.toLocaleString(
                  'vi-VN'
                )}{' '}
                đ
              </span>
            </Link>
          </div>

          <div className="mobile-search-row">
            <input
              type="text"
              className="mobile-search-input"
              placeholder="Tìm sản phẩm..."
              value={keyword}
              onChange={
                e =>
                  setKeyword(
                    e.target.value
                  )
              }
              onKeyDown={
                handleKeyDownSearch
              }
            />

            <button
              type="button"
              className="mobile-search-button"
              onClick={
                handleSearch
              }
            >
              Tìm
            </button>
          </div>

          <div className="mobile-toolbar-row">
            <select
              className="mobile-category-select"
              value={
                selectedCategory
              }
              onChange={
                e =>
                  setSelectedCategory(
                    e.target.value
                  )
              }
            >
              <option value="all">
                Tất cả danh mục
              </option>

              {searchOptions.map(
                item => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              className={`mobile-menu-toggle ${
                showMobileMenu
                  ? 'is-open'
                  : ''
              }`}
              onClick={() =>
                setShowMobileMenu(
                  current =>
                    !current
                )
              }
              aria-expanded={
                showMobileMenu
              }
              aria-controls="wind-flower-mobile-menu"
            >
              {showMobileMenu ? (
                <FaTimes />
              ) : (
                <FaBars />
              )}

              <span>
                {showMobileMenu
                  ? 'Đóng'
                  : 'Menu'}
              </span>
            </button>
          </div>
        </div>

        {showMobileMenu && (
          <div
            className="mobile-menu-panel"
            id="wind-flower-mobile-menu"
          >
            <div className="mobile-menu-inner">
              {customer ? (
                <div className="mobile-account-box">
                  <div className="mobile-account-avatar">
                    {avatarLetter}
                  </div>

                  <div className="mobile-account-info">
                    <strong>
                      {displayName}
                    </strong>

                    <span>
                      {customer?.email ||
                        'Tài khoản Wind Flower'}
                    </span>
                  </div>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="mobile-menu-account-login"
                  onClick={
                    closeMobileMenu
                  }
                >
                  Đăng nhập / Đăng ký
                </Link>
              )}

              <nav className="mobile-nav">
                <Link
                  to="/"
                  className="mobile-nav-link"
                  onClick={
                    closeMobileMenu
                  }
                >
                  Trang chủ
                </Link>

                <div className="mobile-nav-group">
                  <button
                    type="button"
                    className="mobile-nav-group-button"
                    onClick={() =>
                      setShowMobileCategories(
                        current =>
                          !current
                      )
                    }
                    aria-expanded={
                      showMobileCategories
                    }
                  >
                    <span>
                      Danh mục sản phẩm
                    </span>

                    <FaChevronDown
                      className={`mobile-chevron ${
                        showMobileCategories
                          ? 'is-open'
                          : ''
                      }`}
                    />
                  </button>

                  {showMobileCategories && (
                    <div className="mobile-nav-submenu mobile-category-tree">
                      {loadingCategories && (
                        <div className="mobile-nav-loading">
                          Đang tải danh mục...
                        </div>
                      )}

                      {categories.map(
                        category => (
                          <div
                            className="mobile-category-group"
                            key={
                              category._id ||
                              category.slug
                            }
                          >
                            <Link
                              to={
                                getCategoryPath(
                                  category
                                )
                              }
                              className="mobile-category-title"
                              onClick={
                                closeMobileMenu
                              }
                            >
                              {
                                category.name
                              }
                            </Link>

                            {Array.isArray(
                              category.submenus
                            ) &&
                              category
                                .submenus
                                .length >
                                0 && (
                                <div className="mobile-category-links">
                                  {renderSubmenuLinks(
                                    category.submenus,
                                    closeMobileMenu
                                  )}
                                </div>
                              )}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                {styleItems.length >
                  0 && (
                  <div className="mobile-nav-group">
                    <button
                      type="button"
                      className="mobile-nav-group-button"
                      onClick={() =>
                        setShowMobileStyles(
                          current =>
                            !current
                        )
                      }
                      aria-expanded={
                        showMobileStyles
                      }
                    >
                      <span>
                        Hoa tặng 8-3
                      </span>

                      <FaChevronDown
                        className={`mobile-chevron ${
                          showMobileStyles
                            ? 'is-open'
                            : ''
                        }`}
                      />
                    </button>

                    {showMobileStyles && (
                      <div className="mobile-nav-submenu">
                        {styleItems.map(
                          item => (
                            <Link
                              key={
                                item._id ||
                                item.slug
                              }
                              to={
                                getCategoryPath(
                                  item
                                )
                              }
                              onClick={
                                closeMobileMenu
                              }
                            >
                              {
                                item.name
                              }
                            </Link>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {flowerTypeItems.length >
                  0 && (
                  <div className="mobile-nav-group">
                    <button
                      type="button"
                      className="mobile-nav-group-button"
                      onClick={() =>
                        setShowMobileFlowerTypes(
                          current =>
                            !current
                        )
                      }
                      aria-expanded={
                        showMobileFlowerTypes
                      }
                    >
                      <span>
                        Các loại hoa
                      </span>

                      <FaChevronDown
                        className={`mobile-chevron ${
                          showMobileFlowerTypes
                            ? 'is-open'
                            : ''
                      }`}
                    />
                    </button>

                    {showMobileFlowerTypes && (
                      <div className="mobile-nav-submenu">
                        {flowerTypeItems.map(
                          item => (
                            <Link
                              key={
                                item._id ||
                                item.slug
                              }
                              to={
                                getCategoryPath(
                                  item
                                )
                              }
                              onClick={
                                closeMobileMenu
                              }
                            >
                              {
                                item.name
                              }
                            </Link>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {tulipItem && (
                  <Link
                    to={
                      getCategoryPath(
                        tulipItem
                      )
                    }
                    className="mobile-nav-link mobile-nav-new-link"
                    onClick={
                      closeMobileMenu
                    }
                  >
                    <span>
                      {tulipItem.name}
                    </span>

                    <span className="mobile-new-badge">
                      NEW
                    </span>
                  </Link>
                )}

                {customer && (
                  <Link
                    to="/my-orders"
                    className="mobile-nav-link"
                    onClick={
                      closeMobileMenu
                    }
                  >
                    Đơn hàng của tôi
                  </Link>
                )}
              </nav>

              <div className="mobile-menu-footer">
                <a
                  href="tel:0931303836"
                  className="mobile-hotline-link"
                >
                  Hotline: 093.130.3836
                </a>

                {customer && (
                  <button
                    type="button"
                    className="mobile-logout-button"
                    onClick={
                      handleLogout
                    }
                  >
                    Đăng xuất
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

const userBoxButtonStyle = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  cursor: 'pointer',
  color: 'inherit'
};

const profilePopupStyle = {
  position: 'absolute',
  top: '52px',
  left: 0,
  width: '320px',
  background: '#fff',
  borderRadius: '16px',
  padding: '16px',
  boxShadow:
    '0 12px 30px rgba(0, 0, 0, 0.18)',
  border:
    '1px solid #f4d8e5',
  zIndex: 9999
};

const profileHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '14px',
  paddingBottom: '12px',
  borderBottom:
    '1px solid #eee'
};

const profileAvatarLargeStyle = {
  width: '54px',
  height: '54px',
  minWidth: '54px',
  borderRadius: '50%',
  background:
    'linear-gradient(135deg, #ff4f93, #c81e67)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: '700',
  fontSize: '22px'
};

const profileNameStyle = {
  fontSize: '16px',
  fontWeight: '700',
  color: '#222',
  lineHeight: 1.3,
  wordBreak: 'break-word'
};

const profileSubTextStyle = {
  marginTop: '4px',
  fontSize: '13px',
  color: '#666',
  wordBreak: 'break-word'
};

const profileInfoBoxStyle = {
  background: '#faf7f9',
  borderRadius: '12px',
  padding: '10px 12px'
};

const profileRowStyle = {
  display: 'flex',
  justifyContent:
    'space-between',
  alignItems: 'flex-start',
  gap: '10px',
  padding: '8px 0',
  borderBottom:
    '1px dashed #e7d9df',
  fontSize: '14px'
};

const profileLabelStyle = {
  color: '#444',
  fontWeight: '600',
  minWidth: '82px'
};

const profileValueStyle = {
  color: '#222',
  textAlign: 'right',
  wordBreak: 'break-word',
  flex: 1
};

export default MenuComponent;