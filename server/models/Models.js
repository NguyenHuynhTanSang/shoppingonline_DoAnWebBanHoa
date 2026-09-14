const mongoose = require('mongoose');
const { Schema } = mongoose;
const { DELIVERY_TIME_SLOTS, CARD_MESSAGE_LIMIT, isCalendarDate } = require('../utils/DeliveryValidation');

const {
  DELIVERY_FAILURE_REASONS,
  DELIVERY_ATTEMPT_NOTE_LIMIT
} = require('../utils/DeliveryWorkflow');

// =========================
// Admin
// =========================
const AdminSchema = new Schema({
  tokenVersion: { type: Number, default: 0 },
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
  tokenVersion: { type: Number, default: 0 },
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
  tokenVersion: { type: Number, default: 0 },
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
// Delivery assignment
// =========================
const DeliveryStaffSnapshotSchema = new Schema({
  id: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, trim: true, required: true }
}, { versionKey: false, _id: false });

const DeliveryActorSnapshotSchema = new Schema({
  id: { type: Schema.Types.ObjectId, required: true },
  role: { type: String, enum: ['admin', 'staff'], required: true },
  name: { type: String, trim: true, default: '' }
}, { versionKey: false, _id: false });

const DeliveryAttemptSchema = new Schema({
  attemptedAt: {
    type: Number,
    required: true,
    min: 0
  },

  result: {
    type: String,
    enum: ['failed'],
    required: true
  },

  reason: {
    type: String,
    enum: DELIVERY_FAILURE_REASONS,
    required: true
  },

  note: {
    type: String,
    trim: true,
    maxlength: DELIVERY_ATTEMPT_NOTE_LIMIT,
    default: ''
  },

  actorId: {
    type: Schema.Types.ObjectId,
    required: true
  }
}, { versionKey: false, _id: false });

const DeliverySchema = new Schema({
  assignedStaff: {
    type: DeliveryStaffSnapshotSchema,
    default: null
  },

  assignedAt: {
    type: Number,
    default: null
  },

  assignedBy: {
    type: DeliveryActorSnapshotSchema,
    default: null
  },

  startedAt: {
    type: Number,
    default: null
  },

  deliveredAt: {
    type: Number,
    default: null
  },

  attempts: {
    type: [DeliveryAttemptSchema],
    default: []
  }
}, { versionKey: false, _id: false });
// =========================
// Order
// =========================
const OrderSchema = new Schema({
  checkoutIdempotencyKey: { type: String, select: false },
  checkoutIntentHash: { type: String, select: false },
  // Missing/false: legacy inventory is deducted on completion. No backfill.
  // True: checkout already reserved inventory; only backend sets this flag.
  stockReserved: { type: Boolean, default: false },
  // Optional for historical orders; checkout requires date and slot for new orders.
  deliveryDate: { type: String, validate: value => value == null || isCalendarDate(value) },
  deliveryTimeSlot: { type: String, enum: DELIVERY_TIME_SLOTS },
  cardMessage: { type: String, trim: true, maxlength: CARD_MESSAGE_LIMIT },
  delivery: { type: DeliverySchema, default: undefined },
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
}, { versionKey: false, autoIndex: false });
OrderSchema.index({ 'customer._id': 1, checkoutIdempotencyKey: 1 }, {
  name: 'checkout_customer_key_unique', unique: true,
  partialFilterExpression: { checkoutIdempotencyKey: { $type: 'string' } }
});

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
const SupportRequest = mongoose.model('SupportRequest', new Schema({
  customerId: { type: Schema.Types.ObjectId, required: true },
  orderId: { type: Schema.Types.ObjectId, default: null },
  category: { type: String, enum: ['wrong_product', 'damaged_product', 'refund', 'delivery', 'payment', 'staff', 'order_change'], required: true },
  customerMessage: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['pending', 'in_progress', 'resolved'], default: 'pending' },
  source: { type: String, enum: ['ai_chat'], default: 'ai_chat' },
  assignedTo: { type: new Schema({ id: Schema.Types.ObjectId, role: String, name: String }, { _id: false }), default: null },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: new Schema({ id: Schema.Types.ObjectId, role: String, name: String }, { _id: false }), default: null },
  chatSequence: { type: Number, default: 0 }
}, { versionKey: false, timestamps: true }), 'supportrequests');
const SupportMessageSchema = new Schema({
  supportRequestId: { type: Schema.Types.ObjectId, required: true },
  senderType: { type: String, enum: ['customer', 'staff', 'admin', 'system'], required: true },
  senderId: { type: Schema.Types.ObjectId, required: true },
  clientMessageId: { type: String, required: true, maxlength: 80 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  sequence: { type: Number, required: true }
}, { versionKey: false, timestamps: { createdAt: true, updatedAt: false } });
SupportMessageSchema.index({ supportRequestId: 1, senderId: 1, senderType: 1, clientMessageId: 1 }, { unique: true });
SupportMessageSchema.index({ supportRequestId: 1, sequence: 1 }, { unique: true });
const SupportMessage = mongoose.model('SupportMessage', SupportMessageSchema);
const AIConversationSchema = new Schema({
  lastPolicyTopic: { type: String, enum: ['shopping', 'shipping', 'payment', 'returns', 'refund', 'cancellation', 'order_changes', 'contact', 'hours', 'voucher', null], default: null },
  lastOrderId: { type: String, default: null },
  _id: String,
  owner: { type: String, default: null },
  constraints: { type: new Schema({ keyword: String, occasion: String, color: String, recipient: String, style: String, flower: String, minPrice: Number, maxPrice: Number }, { _id: false }), default: {} },
  productIds: { type: [String], default: [] },
  selectedId: { type: String, default: null },
  revision: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
}, { versionKey: false, timestamps: true });
AIConversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const AIConversation = mongoose.model('AIConversation', AIConversationSchema);

module.exports = {
  AIConversation,
  Admin,
  Category,
  Customer,
  Staff,
  Voucher,
  Product,
  Order,
  Review,
  SupportRequest,
  SupportMessage
};
