require('../utils/MongooseUtil');
const mongoose = require('mongoose');
const Models = require('./Models');

const OrderDAO = {
  async checkoutIndexes() {
    return Models.Order.collection.listIndexes().toArray();
  },
  async selectCheckout(customerId, key, session) {
    const query = Models.Order.findOne({ 'customer._id': new mongoose.Types.ObjectId(customerId), checkoutIdempotencyKey: key })
      .select('+checkoutIdempotencyKey +checkoutIntentHash');
    if (session) query.session(session);
    return query.exec();
  },
  async selectStatusForCustomer(orderId, customerId) {
    if (![orderId, customerId].every(id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id))) return null;
    return Models.Order.findOne({
      _id: new mongoose.Types.ObjectId(orderId),
      'customer._id': new mongoose.Types.ObjectId(customerId)
    }).select('_id status cdate paymentStatus total customerInfo.paymentMethod items.product.name items.quantity').maxTimeMS(3000).lean().exec();
  },
  async lookupForAssistant(customerId, input = {}) {
    const invalid = () => Object.assign(new Error('Invalid order lookup'), { code: 'INVALID_ORDER_LOOKUP' });
    const isId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
    if (!isId(customerId) || !input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
      Object.keys(input).some(key => !['orderId', 'latest', 'statuses', 'limit', 'count', 'beforeOrderId', 'from', 'to'].includes(key))) throw invalid();
    for (const key of ['orderId', 'beforeOrderId']) if (input[key] !== undefined && !isId(input[key])) throw invalid();
    for (const key of ['latest', 'count']) if (input[key] !== undefined && typeof input[key] !== 'boolean') throw invalid();
    const limit = input.limit === undefined ? 5 : input.limit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw invalid();
    if (input.statuses !== undefined && (!Array.isArray(input.statuses) || !input.statuses.length || input.statuses.length > 6 ||
      input.statuses.some(value => !['pending', 'approved', 'preparing', 'delivering', 'completed', 'canceled'].includes(value)))) throw invalid();
    for (const key of ['from', 'to']) if (input[key] !== undefined && (!Number.isSafeInteger(input[key]) || input[key] < 0)) throw invalid();
    if (input.from !== undefined && input.to !== undefined && input.from >= input.to) throw invalid();
    if (input.orderId && Object.keys(input).some(key => key !== 'orderId')) throw invalid();
    if (input.orderId) {
      const order = await this.selectStatusForCustomer(input.orderId, customerId);
      return { orders: order ? [order] : [], total: order ? 1 : 0 };
    }
    const filter = { 'customer._id': new mongoose.Types.ObjectId(customerId) };
    if (input.statuses) filter.status = { $in: input.statuses.flatMap(value => [value, value.toUpperCase()]) };
    if (input.from !== undefined || input.to !== undefined) {
      filter.cdate = {};
      if (input.from !== undefined) filter.cdate.$gte = input.from;
      if (input.to !== undefined) filter.cdate.$lt = input.to;
    }
    if (input.beforeOrderId) {
      const previous = await this.selectStatusForCustomer(input.beforeOrderId, customerId);
      if (!previous || !Number.isFinite(previous.cdate)) return { orders: [], total: 0 };
      filter.$or = [{ cdate: { $lt: previous.cdate } }, { cdate: previous.cdate, _id: { $lt: new mongoose.Types.ObjectId(input.beforeOrderId) } }];
    }
    const orders = await Models.Order.find(filter).select('_id status cdate paymentStatus total customerInfo.paymentMethod items.product.name items.quantity')
      .sort({ cdate: -1, _id: -1 }).limit(input.latest ? 1 : limit).maxTimeMS(3000).lean().exec();
    const total = input.count ? await Models.Order.countDocuments(filter).maxTimeMS(3000).exec() : null;
    return { orders, total };
  },

  async insert(order, session) {
    order._id = new mongoose.Types.ObjectId();
    if (session) {
      const [created] = await Models.Order.create([order], { session });
      return created;
    }
    return Models.Order.create(order);
  },

  async selectByIDWithSession(_id, session) {
    return Models.Order.findById(_id).session(session).exec();
  },

  async transitionStatus(_id, expectedStatus, newStatus, session, customerId, paymentStatus) {
    if (!session?.inTransaction()) throw new Error('Order transition requires a transaction');
    const filter = { _id, status: expectedStatus };
    if (customerId) filter['customer._id'] = customerId;
    const changes = { status: newStatus };
    if (paymentStatus !== undefined) changes.paymentStatus = paymentStatus;
    return Models.Order.findOneAndUpdate(filter, { $set: changes }, { new: true, session }).exec();
  },

  async selectByCustID(_cid) {
    return Models.Order.find({
      'customer._id': new mongoose.Types.ObjectId(_cid)
    }).sort({ cdate: -1 }).exec();
  },

  async selectAll() {
    return Models.Order.find({}).sort({ cdate: -1 }).exec();
  },

  async update(_id, newStatus) {
    return Models.Order.findByIdAndUpdate(
      _id,
      { status: newStatus },
      { new: true }
    ).exec();
  }
};

module.exports = OrderDAO;
