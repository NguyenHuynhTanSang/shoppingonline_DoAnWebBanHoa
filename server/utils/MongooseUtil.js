const mongoose = require('mongoose');
const MyConstants = require('./MyConstants');

async function connectDB() {
  try {
    const dbUser = encodeURIComponent(MyConstants.DB_USER || '');
    const dbPass = encodeURIComponent(MyConstants.DB_PASS || '');

    const uri = `mongodb+srv://${dbUser}:${dbPass}@${MyConstants.DB_SERVER}/${MyConstants.DB_DATABASE}?retryWrites=true&w=majority`;

    console.log('DB_SERVER =', MyConstants.DB_SERVER);
    console.log('DB_USER =', MyConstants.DB_USER);
    console.log('DB_DATABASE =', MyConstants.DB_DATABASE);
    console.log('DB_PASS exists =', !!MyConstants.DB_PASS);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    });

    console.log('Kết nối MongoDB thành công');
    console.log('Host thật:', mongoose.connection.host);
    console.log('DB thật:', mongoose.connection.name);
  } catch (err) {
    console.error('Kết nối MongoDB thất bại:');
    console.error(err.message);
    throw err;
  }
}

module.exports = connectDB;