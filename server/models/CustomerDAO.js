require('../utils/MongooseUtil');
const mongoose = require('mongoose');
const Models = require('./Models');

const CustomerDAO = {
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

  async update(customer) {
    const newvalues = {
      username: customer.username,
      password: customer.password,
      name: customer.name,
      phone: customer.phone,
      email: customer.email
    };
    return Models.Customer.findByIdAndUpdate(customer._id, newvalues, { new: true }).exec();
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
      password: newPassword,
      resetPasswordToken: '',
      resetPasswordExpire: 0
    },
    { new: true }
  ).exec();
}
}


module.exports = CustomerDAO;