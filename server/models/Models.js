const mongoose = require('mongoose');
const { Schema } = mongoose;

// =========================
// Admin
// =========================
const AdminSchema = new Schema({
  _id: Schema.Types.ObjectId,
  username: String,
  password: String
}, { versionKey: false });

// =========================
// Category / Submenu
// =========================
const SubmenuSchema = new Schema({
  _id: Schema.Types.ObjectId,
  name: { type: String, trim: true },
  slug: { type: String, trim: true, default: '' }
}, { versionKey: false });

const CategorySchema = new Schema({
  _id: Schema.Types.ObjectId,
  name: { type: String, trim: true },
  slug: { type: String, trim: true, default: '' },
  submenus: { type: [SubmenuSchema], default: [] }
}, { versionKey: false });

// =========================
// Customer
// =========================
const CustomerSchema = new Schema({
  _id: Schema.Types.ObjectId,
  username: String,
  password: String,
  name: String,
  phone: String,
  email: String,
  active: Number,
  token: String,

  resetPasswordToken: { type: String, default: '' },
  resetPasswordExpire: { type: Number, default: 0 }
}, { versionKey: false });

// =========================
// Staff
// =========================
const StaffSchema = new Schema({
  _id: Schema.Types.ObjectId,
  username: String,
  password: String,
  name: String,
  phone: String,
  email: String,
  active: { type: Number, default: 1 },
  cdate: Number,
  udate: Number
}, { versionKey: false });

// =========================
// Voucher
// =========================
const VoucherSchema = new Schema({
  _id: Schema.Types.ObjectId,

  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    default: ''
  },

  type: {
    type: String,
    enum: ['percent', 'fixed'],
    default: 'fixed'
  },

  value: {
    type: Number,
    required: true,
    min: 0
  },

  minOrderValue: {
    type: Number,
    default: 0,
    min: 0
  },

  maxDiscount: {
    type: Number,
    default: 0,
    min: 0
  },

  startDate: {
    type: Number,
    default: 0
  },

  endDate: {
    type: Number,
    default: 0
  },

  usageLimit: {
    type: Number,
    default: 0,
    min: 0
  },

  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },

  isActive: {
    type: Boolean,
    default: true
  },

  cdate: {
    type: Number,
    default: Date.now
  },

  udate: {
    type: Number,
    default: Date.now
  }
}, { versionKey: false });

// =========================
// Product
// =========================
const ProductSchema = new Schema({
  _id: Schema.Types.ObjectId,
  name: { type: String, trim: true },
  price: Number,
  image: String,
  cdate: Number,
  udate: Number,
  description: String,

  category: CategorySchema,
  submenu: { type: SubmenuSchema, default: null },

  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  discountPrice: { type: Number, default: null, min: 0 },

  stock: { type: Number, default: 0, min: 0 },
  sold: { type: Number, default: 0, min: 0 }
}, { versionKey: false });

// =========================
// Order Item
// =========================
const ItemSchema = new Schema({
  product: ProductSchema,
  quantity: Number
}, { versionKey: false, _id: false });

// =========================
// Order
// =========================
const OrderSchema = new Schema({
  _id: Schema.Types.ObjectId,
  cdate: Number,
  total: Number,
  status: String,

  customer: CustomerSchema,
  items: [ItemSchema],

  customerInfo: {
    fullName: String,
    phone: String,
    address: String,
    note: String,
    paymentMethod: String
  },

  paymentStatus: String,

  voucherCode: {
    type: String,
    default: ''
  },

  subtotal: {
    type: Number,
    default: 0
  },

  discount: {
    type: Number,
    default: 0
  },

  shippingFee: {
    type: Number,
    default: 0
  }
}, { versionKey: false });

// =========================
// Review
// =========================
const ReviewSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  },

  rating: {
    type: Number,
    default: 5,
    min: 1,
    max: 5
  },

  comment: {
    type: String,
    trim: true,
    default: ''
  },

  cdate: {
    type: Number,
    default: Date.now
  },

  product: {
    _id: {
      type: Schema.Types.ObjectId,
      required: true
    },
    name: {
      type: String,
      default: ''
    },
    image: {
      type: String,
      default: ''
    }
  },

  customer: {
    _id: {
      type: Schema.Types.ObjectId,
      required: true
    },
    username: {
      type: String,
      default: ''
    },
    name: {
      type: String,
      default: ''
    }
  },

  order: {
    _id: {
      type: Schema.Types.ObjectId,
      required: true
    }
  }
}, { versionKey: false });

// =========================
// Models
// =========================
const Admin = mongoose.model('Admin', AdminSchema, 'admin');
const Category = mongoose.model('Category', CategorySchema);
const Customer = mongoose.model('Customer', CustomerSchema);
const Staff = mongoose.model('Staff', StaffSchema);
const Voucher = mongoose.model('Voucher', VoucherSchema, 'vouchers');
const Product = mongoose.model('Product', ProductSchema);
const Order = mongoose.model('Order', OrderSchema);
const Review = mongoose.model('Review', ReviewSchema);

module.exports = {
  Admin,
  Category,
  Customer,
  Staff,
  Voucher,
  Product,
  Order,
  Review
};