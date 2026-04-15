const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// utils
const JwtUtil = require('../utils/JwtUtil');
const EmailUtil = require('../utils/EmailUtil');
const MyConstants = require('../utils/MyConstants');

// daos
const CategoryDAO = require('../models/CategoryDAO');
const ProductDAO = require('../models/ProductDAO');
const CustomerDAO = require('../models/CustomerDAO');
const OrderDAO = require('../models/OrderDAO');

// models fallback
const Models = require('../models/Models');

// =========================
// helper
// =========================
function genRandomToken(len = 24) {
  return crypto.randomBytes(len).toString('hex');
}

function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function formatMoney(v) {
  return `${toNumber(v, 0).toLocaleString('vi-VN')} đ`;
}

function normalizeVoucherCode(code = '') {
  return String(code || '').trim().toUpperCase();
}

function normalizeOrderStatus(status = '') {
  return String(status || '').trim().toLowerCase();
}

function canCustomerReviewOrderStatus(status = '') {
  const safeStatus = normalizeOrderStatus(status);
  return ['approved', 'preparing', 'delivering', 'completed'].includes(safeStatus);
}

function getDecodedUser(req) {
  return req.decoded || req.jwtDecoded || req.user || {};
}

function getCustomerIdFromToken(req) {
  const decoded = getDecodedUser(req);
  return decoded.sub || decoded._id || decoded.id || null;
}

function toPlainObject(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') return doc.toObject();
  return doc;
}

function sanitizeCustomer(customerDoc) {
  const customer = toPlainObject(customerDoc);
  if (!customer) return null;

  delete customer.password;
  delete customer.token;
  delete customer.resetPasswordToken;
  delete customer.resetPasswordExpire;
  return customer;
}

function sanitizeCustomerForOrder(customerDoc) {
  return sanitizeCustomer(customerDoc);
}

function sanitizeReview(reviewDoc) {
  const review = toPlainObject(reviewDoc);
  if (!review) return null;

  return {
    _id: review._id,
    rating: toNumber(review.rating, 5),
    comment: String(review.comment || ''),
    cdate: toNumber(review.cdate, 0),
    product: review.product
      ? {
          _id: review.product._id,
          name: review.product.name || '',
          image: review.product.image || ''
        }
      : null,
    customer: review.customer
      ? {
          _id: review.customer._id,
          username: review.customer.username || '',
          name: review.customer.name || ''
        }
      : null,
    order: review.order
      ? {
          _id: review.order._id
        }
      : null
  };
}

function sanitizeReviews(reviews) {
  return (Array.isArray(reviews) ? reviews : [])
    .map((item) => sanitizeReview(item))
    .filter(Boolean);
}

function buildReviewSummary(reviews) {
  const safeReviews = sanitizeReviews(reviews);
  const reviewCount = safeReviews.length;

  if (reviewCount === 0) {
    return {
      reviewCount: 0,
      averageRating: 0
    };
  }

  const totalRating = safeReviews.reduce(
    (sum, item) => sum + toNumber(item.rating, 0),
    0
  );

  return {
    reviewCount,
    averageRating: Math.round((totalRating / reviewCount) * 10) / 10
  };
}

function getPricingInfo(productDoc) {
  const product = toPlainObject(productDoc) || {};

  const originalPrice = Math.max(0, Number(product.price || 0));
  const discountPercent = Math.max(
    0,
    Math.min(100, Number(product.discountPercent || 0))
  );
  const discountPrice = Math.max(0, Number(product.discountPrice || 0));

  let finalPrice = originalPrice;
  let discountLabel = '';

  if (discountPrice > 0 && discountPrice < originalPrice) {
    const candidate = originalPrice - discountPrice;
    if (candidate < finalPrice) {
      finalPrice = candidate;
      discountLabel = `Giảm ${discountPrice.toLocaleString('vi-VN')} đ`;
    }
  }

  if (discountPercent > 0) {
    const candidate = Math.round((originalPrice * (100 - discountPercent)) / 100);
    if (candidate < finalPrice) {
      finalPrice = candidate;
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

function enrichProduct(productDoc) {
  const product = toPlainObject(productDoc);
  if (!product) return null;

  const pricing = getPricingInfo(product);

  return {
    ...product,
    originalPrice: pricing.originalPrice,
    finalPrice: pricing.finalPrice,
    hasDiscount: pricing.hasDiscount,
    savedAmount: pricing.savedAmount,
    discountLabel: pricing.discountLabel
  };
}

function enrichProducts(products) {
  return (Array.isArray(products) ? products : [])
    .map((item) => enrichProduct(item))
    .filter(Boolean);
}

function calculateShippingFee(subtotal) {
  const safeSubtotal = Math.max(0, Number(subtotal || 0));
  return safeSubtotal >= 1500000 ? 0 : 30000;
}

async function loadProductById(productId) {
  let product = null;

  if (typeof ProductDAO.selectByID === 'function') {
    product = await ProductDAO.selectByID(productId);
  }

  if (!product) {
    product = await Models.Product.findById(productId).exec();
  }

  return product;
}

async function loadCustomerById(customerId) {
  let customer = null;

  if (typeof CustomerDAO.selectByID === 'function') {
    customer = await CustomerDAO.selectByID(customerId);
  }

  if (!customer) {
    customer = await Models.Customer.findById(customerId).exec();
  }

  return customer;
}

function getPublicVoucherInfo(voucherDoc) {
  const voucher = toPlainObject(voucherDoc) || {};

  return {
    _id: voucher._id,
    code: voucher.code || '',
    name: voucher.name || '',
    description: voucher.description || '',
    type: voucher.type || 'fixed',
    value: toNumber(voucher.value, 0),
    minOrderValue: toNumber(voucher.minOrderValue, 0),
    maxDiscount: toNumber(voucher.maxDiscount, 0),
    startDate: toNumber(voucher.startDate, 0),
    endDate: toNumber(voucher.endDate, 0),
    usageLimit: toNumber(voucher.usageLimit, 0),
    usedCount: toNumber(voucher.usedCount, 0),
    isActive: Boolean(voucher.isActive)
  };
}

function calculateDiscountFromVoucher(voucherDoc, subtotal) {
  const voucher = toPlainObject(voucherDoc) || {};
  const safeSubtotal = Math.max(0, Number(subtotal || 0));

  let discount = 0;

  if (String(voucher.type || '').toLowerCase() === 'percent') {
    discount = Math.floor((safeSubtotal * Number(voucher.value || 0)) / 100);

    const maxDiscount = Number(voucher.maxDiscount || 0);
    if (maxDiscount > 0) {
      discount = Math.min(discount, maxDiscount);
    }
  } else {
    discount = Number(voucher.value || 0);
  }

  return Math.max(0, Math.min(Math.floor(discount), safeSubtotal));
}

async function validateVoucherForSubtotal(voucherCode, subtotal) {
  const code = normalizeVoucherCode(voucherCode);
  const safeSubtotal = Math.max(0, Number(subtotal || 0));

  if (!code) {
    return {
      success: true,
      message: 'Không áp dụng voucher',
      voucher: null,
      voucherInfo: null,
      voucherCode: '',
      discount: 0,
      totalAfterDiscount: safeSubtotal
    };
  }

  const voucher = await Models.Voucher.findOne({ code }).exec();

  if (!voucher) {
    return {
      success: false,
      message: 'Mã voucher không tồn tại'
    };
  }

  const now = Date.now();
  const startDate = toNumber(voucher.startDate, 0);
  const endDate = toNumber(voucher.endDate, 0);
  const minOrderValue = toNumber(voucher.minOrderValue, 0);
  const usageLimit = toNumber(voucher.usageLimit, 0);
  const usedCount = toNumber(voucher.usedCount, 0);

  if (!voucher.isActive) {
    return {
      success: false,
      message: 'Voucher hiện đang bị khóa'
    };
  }

  if (startDate > 0 && now < startDate) {
    return {
      success: false,
      message: 'Voucher chưa đến ngày sử dụng'
    };
  }

  if (endDate > 0 && now > endDate) {
    return {
      success: false,
      message: 'Voucher đã hết hạn'
    };
  }

  if (safeSubtotal < minOrderValue) {
    return {
      success: false,
      message: `Đơn hàng phải từ ${formatMoney(minOrderValue)} mới áp dụng được voucher`
    };
  }

  if (usageLimit > 0 && usedCount >= usageLimit) {
    return {
      success: false,
      message: 'Voucher đã hết lượt sử dụng'
    };
  }

  const discount = calculateDiscountFromVoucher(voucher, safeSubtotal);

  if (discount <= 0) {
    return {
      success: false,
      message: 'Voucher không áp dụng được cho đơn hàng này'
    };
  }

  return {
    success: true,
    message: 'Áp dụng voucher thành công',
    voucher: voucher,
    voucherInfo: getPublicVoucherInfo(voucher),
    voucherCode: code,
    discount: discount,
    totalAfterDiscount: Math.max(safeSubtotal - discount, 0)
  };
}

async function buildOrderItemsFromRawItems(rawItems = [], options = {}) {
  const checkStock = Boolean(options.checkStock);
  const orderItems = [];
  let subtotal = 0;

  for (const item of Array.isArray(rawItems) ? rawItems : []) {
    const productId = String(
      item?._id || item?.id || item?.productId || item?.product?._id || ''
    ).trim();

    const quantity = Math.floor(Number(item?.quantity || 0));

    if (!productId || quantity <= 0) continue;

    const productDoc = await loadProductById(productId);

    if (!productDoc) {
      return {
        success: false,
        message: `Sản phẩm không tồn tại: ${item?.name || productId}`
      };
    }

    const product = toPlainObject(productDoc);
    const currentStock = Number(product.stock || 0);

    if (checkStock && currentStock < quantity) {
      return {
        success: false,
        message: `Sản phẩm "${product.name}" chỉ còn ${currentStock} trong kho`
      };
    }

    const pricing = getPricingInfo(product);

    const orderProductSnapshot = {
      ...product,
      price: pricing.finalPrice,
      discountPercent: 0,
      discountPrice: null
    };

    orderItems.push({
      product: orderProductSnapshot,
      quantity: quantity
    });

    subtotal += pricing.finalPrice * quantity;
  }

  if (orderItems.length === 0) {
    return {
      success: false,
      message: 'Không có sản phẩm hợp lệ trong giỏ hàng'
    };
  }

  return {
    success: true,
    orderItems,
    subtotal
  };
}

async function requireActiveCustomer(req, res, next) {
  try {
    const customerId = getCustomerIdFromToken(req);

    if (!customerId) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Token khách hàng không hợp lệ'
      });
    }

    const customer = await loadCustomerById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy khách hàng'
      });
    }

    if (Number(customer.active) === -1) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Tài khoản của bạn đã bị khóa'
      });
    }

    if (Number(customer.active) === 0) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_INACTIVE',
        message: 'Tài khoản của bạn chưa được kích hoạt'
      });
    }

    req.dbCustomer = customer;
    next();
  } catch (err) {
    console.error('REQUIRE ACTIVE CUSTOMER ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
}

// =========================
// category
// =========================
router.get('/categories', async function (req, res) {
  try {
    const categories = await CategoryDAO.selectAll();
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// =========================
// product
// =========================
router.get('/products/new', async function (req, res) {
  try {
    const products = await ProductDAO.selectTopNew(3);
    res.json(enrichProducts(products));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

router.get('/products/hot', async function (req, res) {
  try {
    const products = await ProductDAO.selectTopHot(3);
    res.json(enrichProducts(products));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

router.get('/products/category/:cid', async function (req, res) {
  try {
    const cid = req.params.cid;
    const products = await ProductDAO.selectByCatID(cid);
    res.json(enrichProducts(products));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

router.get('/products/search/:keyword', async function (req, res) {
  try {
    const keyword = req.params.keyword || '';
    let products = [];

    if (typeof ProductDAO.selectByKeyword === 'function') {
      products = await ProductDAO.selectByKeyword(keyword);
    } else {
      products = await Models.Product.find({
        name: { $regex: keyword, $options: 'i' }
      }).exec();
    }

    res.json(enrichProducts(products));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

router.get('/products/:id', async function (req, res) {
  try {
    const id = req.params.id;
    const product = await ProductDAO.selectByID(id);
    res.json(enrichProduct(product) || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({});
  }
});

router.get('/all-products', async function (req, res) {
  try {
    let products = [];

    if (typeof ProductDAO.selectAll === 'function') {
      products = await ProductDAO.selectAll();
    } else {
      products = await Models.Product.find({}).sort({ cdate: -1 }).exec();
    }

    res.json(enrichProducts(products));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// =========================
// reviews
// =========================
router.get('/reviews/product/:pid', async function (req, res) {
  try {
    const pid = String(req.params.pid || '').trim();

    if (!pid) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu mã sản phẩm',
        reviews: [],
        summary: {
          reviewCount: 0,
          averageRating: 0
        }
      });
    }

    const reviews = await Models.Review.find({ 'product._id': pid })
      .sort({ cdate: -1 })
      .exec();

    const safeReviews = sanitizeReviews(reviews);
    const summary = buildReviewSummary(reviews);

    return res.json({
      success: true,
      reviews: safeReviews,
      summary: summary
    });
  } catch (err) {
    console.error('GET PRODUCT REVIEWS ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error',
      reviews: [],
      summary: {
        reviewCount: 0,
        averageRating: 0
      }
    });
  }
});

router.get('/products/:id/reviews', async function (req, res) {
  try {
    const pid = String(req.params.id || '').trim();

    if (!pid) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu mã sản phẩm',
        reviews: [],
        summary: {
          reviewCount: 0,
          averageRating: 0
        }
      });
    }

    const reviews = await Models.Review.find({ 'product._id': pid })
      .sort({ cdate: -1 })
      .exec();

    const safeReviews = sanitizeReviews(reviews);
    const summary = buildReviewSummary(reviews);

    return res.json({
      success: true,
      reviews: safeReviews,
      summary: summary
    });
  } catch (err) {
    console.error('GET PRODUCT REVIEWS ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error',
      reviews: [],
      summary: {
        reviewCount: 0,
        averageRating: 0
      }
    });
  }
});

router.post('/reviews', JwtUtil.checkToken, requireActiveCustomer, async function (req, res) {
  try {
    const customerId = getCustomerIdFromToken(req);
    const dbCustomer = req.dbCustomer;
    const body = req.body || {};

    const productId = String(body.productId || body.pid || '').trim();
    const orderId = String(body.orderId || '').trim();
    const rating = Math.max(1, Math.min(5, Math.floor(Number(body.rating || 5))));
    const comment = String(body.comment || '').trim();

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Token khách hàng không hợp lệ'
      });
    }

    if (!productId || !orderId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu mã sản phẩm hoặc mã đơn hàng'
      });
    }

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập nội dung bình luận'
      });
    }

    const productDoc = await loadProductById(productId);

    if (!productDoc) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }

    const orderDoc = await Models.Order.findById(orderId).exec();

    if (!orderDoc) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    if (String(orderDoc.customer?._id || '') !== String(customerId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền bình luận đơn hàng này'
      });
    }

    if (!canCustomerReviewOrderStatus(orderDoc.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ đơn hàng đã được xử lý mới được bình luận sản phẩm'
      });
    }

    const boughtItem = (Array.isArray(orderDoc.items) ? orderDoc.items : []).find(
      (item) => String(item?.product?._id || '') === String(productId)
    );

    if (!boughtItem) {
      return res.status(400).json({
        success: false,
        message: 'Sản phẩm này không có trong đơn hàng của bạn'
      });
    }

    const existedReview = await Models.Review.findOne({
      'customer._id': customerId,
      'product._id': productId,
      'order._id': orderId
    }).exec();

    if (existedReview) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã bình luận sản phẩm này trong đơn hàng này rồi'
      });
    }

    const productSnapshot = {
      _id: productDoc._id,
      name: productDoc.name || '',
      image: productDoc.image || ''
    };

    const customerSnapshot = {
      _id: dbCustomer._id,
      username: dbCustomer.username || '',
      name: dbCustomer.name || ''
    };

    const review = await Models.Review.create({
      rating,
      comment,
      cdate: Date.now(),
      product: productSnapshot,
      customer: customerSnapshot,
      order: {
        _id: orderDoc._id
      }
    });

    return res.json({
      success: true,
      message: 'Bình luận sản phẩm thành công',
      review: sanitizeReview(review)
    });
  } catch (err) {
    console.error('CREATE REVIEW ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// =========================
// vouchers
// =========================
router.get('/vouchers/available', async function (req, res) {
  try {
    const now = Date.now();

    const vouchers = await Models.Voucher.find({ isActive: true })
      .sort({ cdate: -1, code: 1 })
      .exec();

    const availableVouchers = vouchers
      .filter((voucher) => {
        const startDate = toNumber(voucher.startDate, 0);
        const endDate = toNumber(voucher.endDate, 0);
        const usageLimit = toNumber(voucher.usageLimit, 0);
        const usedCount = toNumber(voucher.usedCount, 0);

        const validStart = startDate <= 0 || now >= startDate;
        const validEnd = endDate <= 0 || now <= endDate;
        const validUsage = usageLimit <= 0 || usedCount < usageLimit;

        return validStart && validEnd && validUsage;
      })
      .map((voucher) => getPublicVoucherInfo(voucher));

    return res.json({
      success: true,
      vouchers: availableVouchers
    });
  } catch (err) {
    console.error('GET AVAILABLE VOUCHERS ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error',
      vouchers: []
    });
  }
});

async function applyVoucherHandler(req, res) {
  try {
    const body = req.body || {};
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const voucherCode = normalizeVoucherCode(body.voucherCode || body.code || '');

    if (!voucherCode) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập mã voucher'
      });
    }

    let subtotal = 0;

    if (rawItems.length > 0) {
      const buildResult = await buildOrderItemsFromRawItems(rawItems, {
        checkStock: false
      });

      if (!buildResult.success) {
        return res.status(400).json({
          success: false,
          message: buildResult.message
        });
      }

      subtotal = buildResult.subtotal;
    } else if (
      body.subtotal !== undefined &&
      body.subtotal !== null &&
      String(body.subtotal).trim() !== ''
    ) {
      subtotal = Math.max(0, toNumber(body.subtotal, 0));
    } else {
      return res.status(400).json({
        success: false,
        message: 'Thiếu subtotal hoặc items để kiểm tra voucher'
      });
    }

    const voucherResult = await validateVoucherForSubtotal(voucherCode, subtotal);

    if (!voucherResult.success) {
      return res.status(400).json({
        success: false,
        message: voucherResult.message
      });
    }

    const shippingFee = calculateShippingFee(subtotal);
    const totalAfterDiscount = Math.max(subtotal - voucherResult.discount, 0);
    const total = Math.max(totalAfterDiscount + shippingFee, 0);

    return res.json({
      success: true,
      message: voucherResult.message,
      voucher: voucherResult.voucherInfo,
      voucherCode: voucherResult.voucherCode,
      subtotal: subtotal,
      discount: voucherResult.discount,
      shippingFee: shippingFee,
      totalAfterDiscount: totalAfterDiscount,
      total: total
    });
  } catch (err) {
    console.error('APPLY VOUCHER ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
}

router.post('/voucher/apply', applyVoucherHandler);
router.post('/apply-voucher', applyVoucherHandler);

// =========================
// customer auth
// =========================
router.post('/signup', async function (req, res) {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!username || !password || !name || !email) {
      return res.json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin'
      });
    }

    const existed = await CustomerDAO.selectByUsernameOrEmail(username, email);
    if (existed) {
      return res.json({
        success: false,
        message: 'Tên đăng nhập hoặc email đã tồn tại'
      });
    }

    const newCust = {
      username,
      password,
      name,
      phone: phone || '',
      email,
      active: 1,
      token: genRandomToken(12)
    };

    const result = await CustomerDAO.insert(newCust);

    res.json({
      success: true,
      message: 'Đăng ký thành công, bạn có thể đăng nhập ngay',
      customer: sanitizeCustomer(result)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

router.post('/login', async function (req, res) {
  try {
    const body = req.body || {};
    const usernameOrEmail = String(body.username || body.email || '').trim();
    const password = String(body.password || '').trim();

    if (!usernameOrEmail || !password) {
      return res.json({
        success: false,
        message: 'Vui lòng nhập username/email và mật khẩu'
      });
    }

    let customer = null;

    if (usernameOrEmail.includes('@')) {
      customer = await Models.Customer.findOne({
        email: usernameOrEmail.toLowerCase(),
        password: password
      }).exec();
    } else {
      customer = await CustomerDAO.selectByUsernameAndPassword(
        usernameOrEmail,
        password
      );
    }

    if (!customer) {
      return res.json({
        success: false,
        message: 'Sai tên đăng nhập/email hoặc mật khẩu'
      });
    }

    if (Number(customer.active) === 0) {
      return res.json({
        success: false,
        message: 'Tài khoản của bạn chưa được kích hoạt'
      });
    }

    if (Number(customer.active) === -1) {
      return res.json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa'
      });
    }

    const token = JwtUtil.genToken({
      sub: String(customer._id),
      username: customer.username,
      role: 'customer'
    });

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      token: token,
      customer: sanitizeCustomer(customer)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

router.get(
  '/session',
  JwtUtil.checkToken,
  requireActiveCustomer,
  async function (req, res) {
    try {
      return res.json({
        success: true,
        customer: sanitizeCustomer(req.dbCustomer)
      });
    } catch (err) {
      console.error('SESSION ERROR:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.post('/forgot-password', async function (req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    console.log('FORGOT EMAIL =', email);

    if (!email) {
      return res.json({
        success: false,
        message: 'Vui lòng nhập email'
      });
    }

    const customer = await CustomerDAO.selectByEmail(email);
    console.log('FOUND CUSTOMER =', customer ? customer.email : null);

    if (!customer) {
      return res.json({
        success: true,
        message:
          'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu'
      });
    }

    const resetToken = genRandomToken(24);
    const resetExpire = Date.now() + 15 * 60 * 1000;

    const updatedCustomer = await CustomerDAO.setResetPasswordToken(
      customer._id,
      resetToken,
      resetExpire
    );

    console.log('RESET TOKEN SAVED =', updatedCustomer?.resetPasswordToken);
    console.log('RESET EXPIRE SAVED =', updatedCustomer?.resetPasswordExpire);

    const resetLink = `${MyConstants.CLIENT_URL}/reset-password?token=${resetToken}`;
    console.log('RESET LINK =', resetLink);

    const mailSent = await Promise.race([
      EmailUtil.sendResetPasswordEmail(
        customer.email,
        customer.name || customer.username,
        resetLink
      ),
      new Promise((resolve) => setTimeout(() => resolve(false), 15000))
    ]);

    console.log('MAIL SENT =', mailSent);

    if (!mailSent) {
      return res.status(200).json({
        success: true,
        message: 'Không gửi được email, dùng link reset tạm thời',
        resetLink: resetLink
      });
    }

    return res.json({
      success: true,
      message: 'Đã gửi link đặt lại mật khẩu tới email của bạn'
    });
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

router.post('/reset-password', async function (req, res) {
  try {
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '').trim();

    if (!token || !password) {
      return res.json({
        success: false,
        message: 'Thiếu token hoặc mật khẩu mới'
      });
    }

    const customer = await CustomerDAO.selectByValidResetToken(token);

    if (!customer) {
      return res.json({
        success: false,
        message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'
      });
    }

    await CustomerDAO.resetPasswordByToken(token, password);

    return res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công'
    });
  } catch (err) {
    console.error('RESET PASSWORD ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

router.put('/profile', JwtUtil.checkToken, requireActiveCustomer, async function (req, res) {
  try {
    const current = req.dbCustomer;

    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng'
      });
    }

    const body = req.body || {};

    const newName = body.name !== undefined ? String(body.name).trim() : current.name;
    const newPhone = body.phone !== undefined ? String(body.phone).trim() : current.phone;
    const newEmail =
      body.email !== undefined ? String(body.email).trim().toLowerCase() : current.email;
    const newUsername =
      body.username !== undefined ? String(body.username).trim() : current.username;

    if (!newName || !newEmail || !newUsername) {
      return res.json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin bắt buộc'
      });
    }

    const existed = await CustomerDAO.selectByUsernameOrEmail(newUsername, newEmail);
    if (existed && String(existed._id) !== String(current._id)) {
      return res.json({
        success: false,
        message: 'Tên đăng nhập hoặc email đã tồn tại'
      });
    }

    current.name = newName;
    current.phone = newPhone;
    current.email = newEmail;
    current.username = newUsername;

    if (body.password && String(body.password).trim() !== '') {
      current.password = String(body.password).trim();
    }

    const updated = await CustomerDAO.update(current);

    res.json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      customer: sanitizeCustomer(updated)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// =========================
// checkout + orders
// =========================
router.post('/checkout', JwtUtil.checkToken, requireActiveCustomer, async function (req, res) {
  try {
    const dbCustomer = req.dbCustomer;

    if (!dbCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const body = req.body || {};
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Giỏ hàng trống'
      });
    }

    const buildResult = await buildOrderItemsFromRawItems(rawItems, { checkStock: true });

    if (!buildResult.success) {
      return res.status(400).json({
        success: false,
        message: buildResult.message
      });
    }

    const orderItems = buildResult.orderItems;
    const subtotal = buildResult.subtotal;

    const voucherCode = normalizeVoucherCode(body.voucherCode || '');
    let voucherResult = {
      success: true,
      voucher: null,
      voucherInfo: null,
      voucherCode: '',
      discount: 0,
      totalAfterDiscount: subtotal
    };

    if (voucherCode) {
      voucherResult = await validateVoucherForSubtotal(voucherCode, subtotal);

      if (!voucherResult.success) {
        return res.status(400).json({
          success: false,
          message: voucherResult.message
        });
      }
    }

    const discount = voucherResult.discount || 0;
    const shippingFee = calculateShippingFee(subtotal);
    const total = Math.max(subtotal - discount + shippingFee, 0);

    const customerInfo = {
      ...(body.customerInfo || {}),
      fullName:
        String(body.customerInfo?.fullName || '').trim() ||
        String(dbCustomer.name || '').trim(),
      phone:
        String(body.customerInfo?.phone || '').trim() ||
        String(dbCustomer.phone || '').trim(),
      email:
        String(body.customerInfo?.email || '').trim().toLowerCase() ||
        String(dbCustomer.email || '').trim().toLowerCase(),
      address: String(body.customerInfo?.address || '').trim(),
      note: String(body.customerInfo?.note || '').trim(),
      paymentMethod: body.customerInfo?.paymentMethod || 'cod'
    };

    const order = {
      cdate: Date.now(),
      total: total,
      status: 'pending',
      customer: sanitizeCustomerForOrder(dbCustomer),
      items: orderItems,
      customerInfo: customerInfo,
      paymentStatus: body.paymentStatus || 'Chờ thanh toán khi nhận hàng',
      voucherCode: voucherResult.voucherCode || '',
      subtotal: subtotal,
      discount: discount,
      shippingFee: shippingFee
    };

    const result = await OrderDAO.insert(order);

    if (voucherResult.voucher) {
      await Models.Voucher.findByIdAndUpdate(voucherResult.voucher._id, {
        $inc: { usedCount: 1 },
        $set: { udate: Date.now() }
      }).exec();
    }

    return res.json({
      success: true,
      message: 'Đặt hàng thành công',
      order: result,
      pricing: {
        subtotal,
        discount,
        shippingFee,
        total
      }
    });
  } catch (err) {
    console.error('CHECKOUT BACKEND ERROR:', err);
    console.error(err.stack);

    return res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

router.get('/orders', JwtUtil.checkToken, requireActiveCustomer, async function (req, res) {
  try {
    const customerId = getCustomerIdFromToken(req);

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Token khách hàng không hợp lệ'
      });
    }

    const orders = await OrderDAO.selectByCustID(customerId);

    const normalizedOrders = (Array.isArray(orders) ? orders : []).map((order) => {
      const safeOrder = toPlainObject(order) || {};
      const canReview = canCustomerReviewOrderStatus(safeOrder.status);

      return {
        ...safeOrder,
        canReview,
        items: (Array.isArray(safeOrder.items) ? safeOrder.items : []).map((item) => ({
          ...item,
          canReview
        }))
      };
    });

    res.json({
      success: true,
      orders: normalizedOrders
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

router.put('/orders/:id/cancel', JwtUtil.checkToken, requireActiveCustomer, async function (req, res) {
  try {
    const customerId = getCustomerIdFromToken(req);
    const orderId = String(req.params.id || '').trim();

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Token khách hàng không hợp lệ'
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu mã đơn hàng'
      });
    }

    const order = await Models.Order.findById(orderId).exec();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    const orderCustomerId = String(order.customer?._id || '');

    if (orderCustomerId !== String(customerId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền hủy đơn hàng này'
      });
    }

    const currentStatus = String(order.status || '').toLowerCase();

    if (currentStatus === 'canceled') {
      return res.json({
        success: false,
        message: 'Đơn hàng này đã được hủy trước đó'
      });
    }

    if (currentStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ đơn hàng đang chờ xác nhận mới được hủy'
      });
    }

    order.status = 'canceled';
    order.udate = Date.now();

    const savedOrder = await order.save();

    if (order.voucherCode) {
      await Models.Voucher.findOneAndUpdate(
        {
          code: normalizeVoucherCode(order.voucherCode),
          usedCount: { $gt: 0 }
        },
        {
          $inc: { usedCount: -1 },
          $set: { udate: Date.now() }
        }
      ).exec();
    }

    return res.json({
      success: true,
      message: 'Hủy đơn hàng thành công',
      order: savedOrder
    });
  } catch (err) {
    console.error('CANCEL ORDER ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

module.exports = router;