const { SupportRequest, Customer } = require('./Models');
const projection = '_id customerId orderId category customerMessage status source createdAt updatedAt assignedTo resolvedAt resolvedBy';

module.exports = {
  async list({ status, category, search, sort, page }) {
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const customers = await Customer.find({ $or: [{ name: regex }, { username: regex }] }).select('_id').maxTimeMS(3000).lean().exec();
      filter.$or = [{ customerId: { $in: customers.map(c => c._id) } }];
      if (/^[a-f\d]{24}$/i.test(search)) filter.$or.push({ _id: search }, { orderId: search }, { customerId: search });
    }
    const [requests, total, groups] = await Promise.all([
      SupportRequest.find(filter).select(projection).populate({ path: 'customerId', model: Customer, select: 'name username' })
        .sort({ createdAt: sort === 'oldest' ? 1 : -1, _id: sort === 'oldest' ? 1 : -1 }).skip((page - 1) * 25).limit(25).maxTimeMS(3000).lean().exec(),
      SupportRequest.countDocuments(filter).maxTimeMS(3000).exec(),
      SupportRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).option({ maxTimeMS: 3000 }).exec()
    ]);
    const stats = { total: 0, pending: 0, in_progress: 0, resolved: 0 };
    for (const group of groups) { if (Object.hasOwn(stats, group._id) && group._id !== 'total') stats[group._id] = group.count; stats.total += group.count; }
    return { requests, total, stats, page, pageSize: 25 };
  },
  async detail(id) {
    return SupportRequest.findById(id).select(projection).populate({ path: 'customerId', model: Customer, select: 'name username email phone' }).lean().maxTimeMS(3000).exec();
  },
  async transition(id, status, actor) {
    const previous = status === 'in_progress' ? 'pending' : 'in_progress';
    const update = { status };
    const filter = { _id: id, status: previous };
    if (status === 'in_progress') update.assignedTo = actor;
    if (status === 'resolved') {
      update.resolvedAt = new Date();
      update.resolvedBy = actor;
      if (actor.role === 'staff') {
        filter['assignedTo.id'] = actor.id;
        filter['assignedTo.role'] = 'staff';
      }
    }
    return SupportRequest.findOneAndUpdate(filter, { $set: update }, { new: true, runValidators: true })
      .select(projection).maxTimeMS(3000).lean().exec();
  },
  async selectOpen({ customerId, orderId, category }) {
    return SupportRequest.findOne({ customerId, orderId, category,
      status: { $in: ['pending', 'in_progress'] }
    }).select('_id').maxTimeMS(3000).lean().exec();
  },
  async insert({ customerId, orderId, category, customerMessage }) {
    return SupportRequest.create({ customerId, orderId, category, customerMessage, status: 'pending', source: 'ai_chat' });
  }
};
