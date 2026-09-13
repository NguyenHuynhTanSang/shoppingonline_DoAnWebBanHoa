const jwt = require('jsonwebtoken');
const MyConstants = require('./MyConstants');

function extractToken(req) {
  let token = req.headers['x-access-token'] || req.headers['authorization'];
  if (!token) return null;

  if (typeof token === 'string' && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }

  return token;
}

const JwtUtil = {
  genToken(payload = {}) {
    return jwt.sign(payload, MyConstants.JWT_SECRET, {
      expiresIn: MyConstants.JWT_EXPIRES
    });
  },

  extractToken,
  verifyToken(token) {
    return jwt.verify(token, MyConstants.JWT_SECRET);
  },

  isCurrentSession(decoded, account) {
    const expected = decoded?.tokenVersion ?? 0;
    const current = account?.tokenVersion ?? 0;
    return !!account && Number.isSafeInteger(expected) && expected >= 0 &&
      Number.isSafeInteger(current) && current >= 0 && expected === current;
  },

  async verifySession(token) {
    const decoded = JwtUtil.verifyToken(token);
    const Models = require('../models/Models');
    const model = { admin: Models.Admin, staff: Models.Staff, customer: Models.Customer }[decoded.role];
    if (!model || typeof decoded.sub !== 'string' || !/^[a-f\d]{24}$/i.test(decoded.sub)) throw Error('Invalid session');
    const account = await model.findById(decoded.sub).select('_id active tokenVersion').lean().exec();
    if (!JwtUtil.isCurrentSession(decoded, account) ||
      (decoded.role === 'staff' && Number(account.active) !== 1) ||
      (decoded.role === 'customer' && [0, -1].includes(Number(account.active)))) throw Error('Invalid session');
    return decoded;
  },

  async checkToken(req, res, next) {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Auth token is not supplied'
      });
    }

    try {
      req.decoded = await JwtUtil.verifySession(token);
    } catch {
      return res.status(401).json({ success: false, message: 'Token is not valid' });
    }
    return next();
  },

  requireRoles(roles = []) {
    return function (req, res, next) {
      const role = req.decoded?.role;

      if (!role || !roles.includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: insufficient permission'
        });
      }

      next();
    };
  }
};

module.exports = JwtUtil;
