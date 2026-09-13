require('../utils/MongooseUtil');
const Models = require('./Models');

const AdminDAO = {
  async selectByID(_id) {
    return Models.Admin.findById(_id).exec();
  },
  async migrateLegacyPasswordIfUnchanged(_id, expectedStoredPassword, newHash) {
    return Models.Admin.findOneAndUpdate(
      { _id, password: expectedStoredPassword },
      { $set: { password: newHash } },
      { new: true }
    ).exec();
  },
  async selectByUsername(username) {
    return Models.Admin.findOne({ username }).exec();
  },
  async selectByUsernameAndPassword(username, password) {
    const query = { username, password };
    return Models.Admin.findOne(query).exec();
  }
};

module.exports = AdminDAO;
