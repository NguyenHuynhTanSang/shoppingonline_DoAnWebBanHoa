require('../utils/MongooseUtil');
const mongoose = require('mongoose');
const Models = require('./Models');

const OrderDAO = {
  async insert(order) {
    order._id = new mongoose.Types.ObjectId();
    return Models.Order.create(order);
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