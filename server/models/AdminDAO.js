require('../utils/MongooseUtil');
const Models = require('./Models');

const AdminDAO = {
  async selectByUsernameAndPassword(username, password) {
    const query = { username, password };
    return Models.Admin.findOne(query).exec();
  }
};

module.exports = AdminDAO;