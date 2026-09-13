require('../utils/MongooseUtil');
const mongoose = require('mongoose');
const Models = require('./Models');

const CustomerDAO = {
  async migrateLegacyPasswordIfUnchanged(_id, expectedStoredPassword, newHash) {
    return Models.Customer.findOneAndUpdate(
      { _id, password: expectedStoredPassword, active: { $nin: [0, -1] } },
      { $set: { password: newHash } },
      { new: true }
    ).exec();
  },
  async selectByUsername(username) {
    return Models.Customer.findOne({ username }).exec();
  },
  async selectByUsernameOrEmail(username, email) {
    const query = { $or: [{ username }, { email }] };
    return Models.Customer.findOne(query).exec();
  },

  async insert(customer) {
    customer._id = new mongoose.Types.ObjectId();
    return Models.Customer.create(customer);
  },

  async active(_id, token, active) {
    const query = { _id, token };
    const newvalues = { active };
    return Models.Customer.findOneAndUpdate(query, newvalues, { new: true }).exec();
  },

  async selectByUsernameAndPassword(username, password) {
    const query = { username, password };
    return Models.Customer.findOne(query).exec();
  },

  async update(customer, passwordChanged = false) {
    const newvalues = {
      username: customer.username,
      name: customer.name,
      phone: customer.phone,
      email: customer.email
    };
    if (passwordChanged) newvalues.password = customer.password;
    return Models.Customer.findByIdAndUpdate(customer._id, {
      $set: newvalues, ...(passwordChanged ? { $inc: { tokenVersion: 1 } } : {})
    }, { new: true }).exec();
  },

  async selectAll() {
    return Models.Customer.find({}).exec();
  },

  async selectByID(_id) {
    return Models.Customer.findById(_id).exec();
  },
  async selectByEmail(email) {
  return Models.Customer.findOne({ email }).exec();
},

async setResetPasswordToken(_id, token, expire) {
  return Models.Customer.findByIdAndUpdate(
    _id,
    {
      resetPasswordToken: token,
      resetPasswordExpire: expire
    },
    { new: true }
  ).exec();
},

async selectByValidResetToken(token) {
  return Models.Customer.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: Date.now() }
  }).exec();
},

async resetPasswordByToken(token, newPassword) {
  return Models.Customer.findOneAndUpdate(
    {
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    },
    {
      $set: {
        password: newPassword,
        resetPasswordToken: '',
        resetPasswordExpire: 0
      },
      $inc: { tokenVersion: 1 }
    },
    { new: true }
  ).exec();
}
}


module.exports = CustomerDAO;
