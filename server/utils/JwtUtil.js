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

  checkToken(req, res, next) {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Auth token is not supplied'
      });
    }

    jwt.verify(token, MyConstants.JWT_SECRET, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Token has expired'
          });
        }

        return res.status(401).json({
          success: false,
          message: 'Token is not valid'
        });
      }

      req.decoded = decoded;
      next();
    });
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