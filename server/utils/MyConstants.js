const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  throw new Error('JWT_SECRET is required');
}

const MyConstants = {
  DB_SERVER: process.env.DB_SERVER || '',
  DB_USER: process.env.DB_USER || '',
  DB_PASS: process.env.DB_PASS || '',
  DB_DATABASE: process.env.DB_DATABASE || '',

  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',

  CLIENT_URL: process.env.CLIENT_URL || 'https://shoppingonline-doanwebbanhoa.onrender.com',

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES: process.env.JWT_EXPIRES || '7d'
};

module.exports = MyConstants;