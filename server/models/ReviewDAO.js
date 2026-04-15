const mongoose = require('mongoose');
const Review = require('./Models').Review;

async function insert(review) {
  const _id = new mongoose.Types.ObjectId();
  review._id = _id;
  review.cdate = Date.now();
  const result = await Review.create(review);
  return result;
}

async function selectByProductID(pid) {
  const result = await Review.find({ 'product._id': pid }).sort({ cdate: -1 }).lean();
  return result;
}

async function selectByCustomerAndProduct(cid, pid) {
  const result = await Review.findOne({
    'customer._id': cid,
    'product._id': pid
  }).lean();
  return result;
}

async function selectAll() {
  const result = await Review.find({}).sort({ cdate: -1 }).lean();
  return result;
}

module.exports = {
  insert,
  selectByProductID,
  selectByCustomerAndProduct,
  selectAll
};