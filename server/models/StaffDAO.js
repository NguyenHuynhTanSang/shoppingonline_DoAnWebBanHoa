require('../utils/MongooseUtil');
const mongoose = require('mongoose');
const Models = require('./Models');

const StaffDAO = {
  async selectAll() {
    return Models.Staff.find({}).exec();
  },

  async selectByID(_id) {
    return Models.Staff.findById(_id).exec();
  },

  async selectByUsername(username) {
    return Models.Staff.findOne({ username }).exec();
  },

  async selectByEmail(email) {
    return Models.Staff.findOne({ email }).exec();
  },

  async selectByUsernameOrEmail(username, email) {
    const query = { $or: [{ username }, { email }] };
    return Models.Staff.findOne(query).exec();
  },

  async selectByUsernameAndPassword(username, password) {
    return Models.Staff.findOne({
      username,
      password,
      active: 1
    }).exec();
  },

  async insert(staff) {
    staff._id = new mongoose.Types.ObjectId();
    const now = new Date().getTime();
    staff.cdate = now;
    staff.udate = now;
    staff.active = staff.active ?? 1;
    return Models.Staff.create(staff);
  },

  async update(staff) {
    const now = new Date().getTime();
    const newvalues = {
      username: staff.username,
      password: staff.password,
      name: staff.name,
      phone: staff.phone,
      email: staff.email,
      active: staff.active,
      udate: now
    };
    return Models.Staff.findByIdAndUpdate(staff._id, newvalues, { new: true }).exec();
  },

  async setActive(_id, active) {
    const now = new Date().getTime();
    return Models.Staff.findByIdAndUpdate(
      _id,
      { active, udate: now },
      { new: true }
    ).exec();
  },

  async delete(_id) {
    return Models.Staff.findByIdAndDelete(_id).exec();
  }
};

module.exports = StaffDAO;