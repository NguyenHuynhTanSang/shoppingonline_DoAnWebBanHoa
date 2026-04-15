const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// utils
const JwtUtil = require('../utils/JwtUtil');

// daos
const AdminDAO = require('../models/AdminDAO');
const StaffDAO = require('../models/StaffDAO');
const CategoryDAO = require('../models/CategoryDAO');
const ProductDAO = require('../models/ProductDAO');
const OrderDAO = require('../models/OrderDAO');
const CustomerDAO = require('../models/CustomerDAO');

// models fallback
const Models = require('../models/Models');

// =========================
// helpers
// =========================
function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function toSlug(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function genRandomPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function normalizeSubmenus(submenus = []) {
  if (!Array.isArray(submenus)) return [];
  return submenus
    .map((s) => {
      const name = String(s?.name || '').trim();
      return {
        _id: s?._id ? s._id : new mongoose.Types.ObjectId(),
        name,
        slug: String(s?.slug || '').trim() || toSlug(name)
      };
    })
    .filter((s) => s.name !== '');
}

function buildCategorySnapshot(categoryDoc) {
  if (!categoryDoc) return null;

  return {
    _id: categoryDoc._id,
    name: categoryDoc.name || '',
    slug: categoryDoc.slug || toSlug(categoryDoc.name || ''),
    submenus: normalizeSubmenus(categoryDoc.submenus || [])
  };
}

function buildSubmenuSnapshot(submenuDoc) {
  if (!submenuDoc) return null;

  return {
    _id: submenuDoc._id,
    name: submenuDoc.name || '',
    slug: submenuDoc.slug || toSlug(submenuDoc.name || '')
  };
}

async function syncCategoryToProducts(updatedCategoryDoc) {
  if (!updatedCategoryDoc) return;

  const categorySnapshot = buildCategorySnapshot(updatedCategoryDoc);
  const products = await Models.Product.find({
    'category._id': updatedCategoryDoc._id
  }).exec();

  for (const product of products) {
    product.category = categorySnapshot;

    if (product.submenu?._id) {
      const matchedSubmenu = categorySnapshot.submenus.find(
        (s) => String(s._id) === String(product.submenu._id)
      );
      product.submenu = matchedSubmenu ? buildSubmenuSnapshot(matchedSubmenu) : null;
    }

    product.udate = Date.now();
    await product.save();
  }
}

function normalizeVoucherCode(code = '') {
  return String(code).trim().toUpperCase();
}

function toBoolean(v, def = false) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off'].includes(s)) return false;
  }
  return def;
}

function buildVoucherData(body = {}, oldVoucher = null) {
  const data = {
    code:
      body.code !== undefined
        ? normalizeVoucherCode(body.code)
        : normalizeVoucherCode(oldVoucher?.code || ''),

    name:
      body.name !== undefined
        ? String(body.name || '').trim()
        : String(oldVoucher?.name || '').trim(),

    description:
      body.description !== undefined
        ? String(body.description || '').trim()
        : String(oldVoucher?.description || '').trim(),

    type:
      body.type !== undefined
        ? String(body.type || '').trim().toLowerCase()
        : String(oldVoucher?.type || 'fixed').trim().toLowerCase(),

    value:
      body.value !== undefined
        ? toNumber(body.value, 0)
        : toNumber(oldVoucher?.value, 0),

    minOrderValue:
      body.minOrderValue !== undefined
        ? toNumber(body.minOrderValue, 0)
        : toNumber(oldVoucher?.minOrderValue, 0),

    maxDiscount:
      body.maxDiscount !== undefined
        ? toNumber(body.maxDiscount, 0)
        : toNumber(oldVoucher?.maxDiscount, 0),

    startDate:
      body.startDate !== undefined
        ? toNumber(body.startDate, 0)
        : toNumber(oldVoucher?.startDate, 0),

    endDate:
      body.endDate !== undefined
        ? toNumber(body.endDate, 0)
        : toNumber(oldVoucher?.endDate, 0),

    usageLimit:
      body.usageLimit !== undefined
        ? toNumber(body.usageLimit, 0)
        : toNumber(oldVoucher?.usageLimit, 0),

    usedCount:
      body.usedCount !== undefined
        ? toNumber(body.usedCount, 0)
        : toNumber(oldVoucher?.usedCount, 0),

    isActive:
      body.isActive !== undefined
        ? toBoolean(body.isActive, true)
        : toBoolean(oldVoucher?.isActive, true)
  };

  if (!['percent', 'fixed'].includes(data.type)) {
    data.type = 'fixed';
  }

  if (data.type === 'fixed') {
    data.maxDiscount = 0;
  }

  return data;
}

function validateVoucherData(voucher) {
  if (!voucher.code) {
    return 'Mã voucher không được để trống';
  }

  if (!voucher.name) {
    return 'Tên voucher không được để trống';
  }

  if (!['percent', 'fixed'].includes(voucher.type)) {
    return 'Loại voucher không hợp lệ';
  }

  if (Number(voucher.value) <= 0) {
    return 'Giá trị giảm phải lớn hơn 0';
  }

  if (voucher.type === 'percent' && Number(voucher.value) > 100) {
    return 'Voucher phần trăm không được lớn hơn 100';
  }

  if (Number(voucher.minOrderValue) < 0) {
    return 'Đơn tối thiểu không hợp lệ';
  }

  if (Number(voucher.maxDiscount) < 0) {
    return 'Giảm tối đa không hợp lệ';
  }

  if (Number(voucher.usageLimit) < 0) {
    return 'Giới hạn sử dụng không hợp lệ';
  }

  if (Number(voucher.usedCount) < 0) {
    return 'Số lượt đã dùng không hợp lệ';
  }

  if (
    Number(voucher.startDate) > 0 &&
    Number(voucher.endDate) > 0 &&
    Number(voucher.endDate) < Number(voucher.startDate)
  ) {
    return 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu';
  }

  return '';
}

// =========================
// login
// =========================
router.post('/login', async function (req, res) {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.json({
        success: false,
        message: 'Username and password are required'
      });
    }

    let admin = null;
    if (typeof AdminDAO.selectByUsernameAndPassword === 'function') {
      admin = await AdminDAO.selectByUsernameAndPassword(username, password);
    } else {
      admin = await Models.Admin.findOne({ username, password }).exec();
    }

    if (admin) {
      const token = JwtUtil.genToken({
        sub: admin._id,
        username: admin.username,
        role: 'admin'
      });

      return res.json({
        success: true,
        message: 'Login successful',
        token: token,
        user: {
          _id: admin._id,
          username: admin.username,
          role: 'admin'
        }
      });
    }

    let staff = null;
    if (typeof StaffDAO.selectByUsernameAndPassword === 'function') {
      staff = await StaffDAO.selectByUsernameAndPassword(username, password);
    } else {
      staff = await Models.Staff.findOne({ username, password }).exec();
    }

    if (staff && Number(staff.active) !== 1) {
      staff = null;
    }

    if (staff) {
      const token = JwtUtil.genToken({
        sub: staff._id,
        username: staff.username,
        role: 'staff'
      });

      return res.json({
        success: true,
        message: 'Login successful',
        token: token,
        user: {
          _id: staff._id,
          username: staff.username,
          name: staff.name,
          role: 'staff'
        }
      });
    }

    return res.json({
      success: false,
      message: 'Incorrect username or password'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// =========================
// dashboard / statistics
// =========================
router.get(
  '/statistics',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const products =
        typeof ProductDAO.selectAll === 'function'
          ? await ProductDAO.selectAll()
          : await Models.Product.find({}).exec();

      const categories = await Models.Category.find({}).exec();

      const customers =
        typeof CustomerDAO.selectAll === 'function'
          ? await CustomerDAO.selectAll()
          : await Models.Customer.find({}).exec();

      const orders =
        typeof OrderDAO.selectAll === 'function'
          ? await OrderDAO.selectAll()
          : await Models.Order.find({}).exec();

      const revenue = orders.reduce((sum, item) => sum + Number(item.total || 0), 0);
      const totalStock = products.reduce((sum, item) => sum + Number(item.stock || 0), 0);
      const totalSold = products.reduce((sum, item) => sum + Number(item.sold || 0), 0);
      const lowStockCount = products.filter(
        (item) => Number(item.stock || 0) > 0 && Number(item.stock || 0) <= 5
      ).length;
      const outOfStockCount = products.filter((item) => Number(item.stock || 0) <= 0).length;

      res.json({
        success: true,
        statistics: {
          productCount: products.length,
          categoryCount: categories.length,
          customerCount: customers.length,
          orderCount: orders.length,
          revenue: revenue,
          totalStock: totalStock,
          totalSold: totalSold,
          lowStockCount: lowStockCount,
          outOfStockCount: outOfStockCount
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// =========================
// staff
// =========================
router.get(
  '/staffs',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin']),
  async function (req, res) {
    try {
      const staffs =
        typeof StaffDAO.selectAll === 'function'
          ? await StaffDAO.selectAll()
          : await Models.Staff.find({}).sort({ cdate: -1 }).exec();

      res.json({
        success: true,
        staffs: staffs
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

router.post(
  '/staff',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin']),
  async function (req, res) {
    try {
      const body = req.body || {};

      const newStaff = {
        username: String(body.username || '').trim(),
        password: String(body.password || genRandomPassword()).trim(),
        name: String(body.name || '').trim(),
        phone: String(body.phone || '').trim(),
        email: String(body.email || '').trim(),
        active: body.active ?? 1,
        cdate: Date.now(),
        udate: Date.now()
      };

      if (!newStaff.username || !newStaff.password || !newStaff.name) {
        return res.json({
          success: false,
          message: 'Thiếu thông tin nhân viên'
        });
      }

      const existed = await Models.Staff.findOne({
        $or: [
          { username: newStaff.username },
          ...(newStaff.email ? [{ email: newStaff.email }] : [])
        ]
      }).exec();

      if (existed) {
        return res.json({
          success: false,
          message: 'Username hoặc email staff đã tồn tại'
        });
      }

      let result = null;
      if (typeof StaffDAO.insert === 'function') {
        result = await StaffDAO.insert(newStaff);
      } else {
        result = await Models.Staff.create({
          _id: new mongoose.Types.ObjectId(),
          ...newStaff
        });
      }

      res.json({
        success: true,
        message: 'Thêm staff thành công',
        staff: result
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

router.put(
  '/staffs/:id',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin']),
  async function (req, res) {
    try {
      const id = req.params.id;
      const body = req.body || {};

      const oldStaff =
        typeof StaffDAO.selectByID === 'function'
          ? await StaffDAO.selectByID(id)
          : await Models.Staff.findById(id).exec();

      if (!oldStaff) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy nhân viên'
        });
      }

      const username =
        body.username !== undefined ? String(body.username || '').trim() : oldStaff.username;
      const password =
        body.password !== undefined ? String(body.password || '').trim() : oldStaff.password;
      const name = body.name !== undefined ? String(body.name || '').trim() : oldStaff.name;
      const phone = body.phone !== undefined ? String(body.phone || '').trim() : oldStaff.phone;
      const email = body.email !== undefined ? String(body.email || '').trim() : oldStaff.email;
      const active =
        body.active !== undefined ? Number(body.active) : Number(oldStaff.active ?? 1);

      if (!username || !password || !name) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin bắt buộc của nhân viên'
        });
      }

      const duplicated = await Models.Staff.findOne({
        _id: { $ne: id },
        $or: [{ username }, ...(email ? [{ email }] : [])]
      }).exec();

      if (duplicated) {
        return res.status(400).json({
          success: false,
          message: 'Username hoặc email đã tồn tại'
        });
      }

      let updated = null;
      if (typeof StaffDAO.update === 'function') {
        updated = await StaffDAO.update({
          _id: id,
          username,
          password,
          name,
          phone,
          email,
          active
        });
      } else {
        updated = await Models.Staff.findByIdAndUpdate(
          id,
          {
            username,
            password,
            name,
            phone,
            email,
            active,
            udate: Date.now()
          },
          { new: true }
        ).exec();
      }

      res.json({
        success: true,
        message: 'Cập nhật nhân viên thành công',
        staff: updated
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.put(
  '/staffs/:id/status',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin']),
  async function (req, res) {
    try {
      const id = req.params.id;
      const active = Number(req.body.active);

      if (![1, 0].includes(active)) {
        return res.status(400).json({
          success: false,
          message: 'Trạng thái nhân viên không hợp lệ'
        });
      }

      const oldStaff =
        typeof StaffDAO.selectByID === 'function'
          ? await StaffDAO.selectByID(id)
          : await Models.Staff.findById(id).exec();

      if (!oldStaff) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy nhân viên'
        });
      }

      let updated = null;
      if (typeof StaffDAO.setActive === 'function') {
        updated = await StaffDAO.setActive(id, active);
      } else {
        updated = await Models.Staff.findByIdAndUpdate(
          id,
          { active, udate: Date.now() },
          { new: true }
        ).exec();
      }

      res.json({
        success: true,
        message: 'Cập nhật trạng thái nhân viên thành công',
        staff: updated
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.delete(
  '/staffs/:id',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin']),
  async function (req, res) {
    try {
      const id = req.params.id;

      const oldStaff =
        typeof StaffDAO.selectByID === 'function'
          ? await StaffDAO.selectByID(id)
          : await Models.Staff.findById(id).exec();

      if (!oldStaff) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy nhân viên'
        });
      }

      if (typeof StaffDAO.delete === 'function') {
        await StaffDAO.delete(id);
      } else {
        await Models.Staff.findByIdAndDelete(id).exec();
      }

      res.json({
        success: true,
        message: 'Xóa nhân viên thành công'
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

// =========================
// categories
// =========================
router.get(
  '/categories',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const categories = await Models.Category.find({})
        .sort({ name: 1 })
        .exec();

      res.json({
        success: true,
        categories: categories
      });
    } catch (err) {
      console.error('GET CATEGORIES ERROR:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.post(
  '/categories',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const body = req.body || {};
      const categoryName = String(body.name || '').trim();

      if (!categoryName) {
        return res.status(400).json({
          success: false,
          message: 'Tên danh mục không được để trống'
        });
      }

      const categoryData = {
        name: categoryName,
        slug: String(body.slug || '').trim() || toSlug(categoryName),
        submenus: normalizeSubmenus(body.submenus || [])
      };

      const existed = await Models.Category.findOne({
        $or: [{ name: categoryData.name }, { slug: categoryData.slug }]
      }).exec();

      if (existed) {
        return res.status(400).json({
          success: false,
          message: 'Tên danh mục đã tồn tại'
        });
      }

      const result = await Models.Category.create({
        _id: new mongoose.Types.ObjectId(),
        ...categoryData
      });

      res.json({
        success: true,
        message: 'Thêm danh mục thành công',
        category: result
      });
    } catch (err) {
      console.error('CREATE CATEGORY ERROR:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.put(
  '/categories/:id',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const id = req.params.id;
      const body = req.body || {};
      const categoryName = String(body.name || '').trim();

      if (!categoryName) {
        return res.status(400).json({
          success: false,
          message: 'Tên danh mục không được để trống'
        });
      }

      const oldCategory = await Models.Category.findById(id).exec();

      if (!oldCategory) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy danh mục'
        });
      }

      const updateData = {
        name: categoryName,
        slug: String(body.slug || '').trim() || toSlug(categoryName),
        submenus: normalizeSubmenus(body.submenus || [])
      };

      const duplicated = await Models.Category.findOne({
        _id: { $ne: id },
        $or: [{ name: updateData.name }, { slug: updateData.slug }]
      }).exec();

      if (duplicated) {
        return res.status(400).json({
          success: false,
          message: 'Tên danh mục đã tồn tại'
        });
      }

      const result = await Models.Category.findByIdAndUpdate(id, updateData, {
        new: true
      }).exec();

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy danh mục để cập nhật'
        });
      }

      await syncCategoryToProducts(result);

      res.json({
        success: true,
        message: 'Cập nhật danh mục thành công',
        category: result
      });
    } catch (err) {
      console.error('UPDATE CATEGORY ERROR:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.delete(
  '/categories/:id',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin']),
  async function (req, res) {
    try {
      const id = req.params.id;

      const category = await Models.Category.findById(id).exec();
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy danh mục'
        });
      }

      await Models.Category.findByIdAndDelete(id).exec();

      res.json({
        success: true,
        message: 'Xóa danh mục thành công'
      });
    } catch (err) {
      console.error('DELETE CATEGORY ERROR:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

// =========================
// vouchers
// =========================
router.get(
  '/vouchers',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const vouchers = await Models.Voucher.find({})
        .sort({ cdate: -1, code: 1 })
        .exec();

      res.json({
        success: true,
        vouchers: vouchers
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.get(
  '/vouchers/:id',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const voucher = await Models.Voucher.findById(req.params.id).exec();

      if (!voucher) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy voucher'
        });
      }

      res.json({
        success: true,
        voucher: voucher
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.post(
  '/vouchers',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const body = req.body || {};
      const voucherData = buildVoucherData(body);

      const validationMessage = validateVoucherData(voucherData);
      if (validationMessage) {
        return res.status(400).json({
          success: false,
          message: validationMessage
        });
      }

      const existed = await Models.Voucher.findOne({
        code: voucherData.code
      }).exec();

      if (existed) {
        return res.status(400).json({
          success: false,
          message: 'Mã voucher đã tồn tại'
        });
      }

      const voucher = await Models.Voucher.create({
        _id: new mongoose.Types.ObjectId(),
        ...voucherData,
        cdate: Date.now(),
        udate: Date.now()
      });

      res.json({
        success: true,
        message: 'Thêm voucher thành công',
        voucher: voucher
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.put(
  '/vouchers/:id',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const id = req.params.id;
      const oldVoucher = await Models.Voucher.findById(id).exec();

      if (!oldVoucher) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy voucher'
        });
      }

      const voucherData = buildVoucherData(req.body || {}, oldVoucher);

      const validationMessage = validateVoucherData(voucherData);
      if (validationMessage) {
        return res.status(400).json({
          success: false,
          message: validationMessage
        });
      }

      const duplicated = await Models.Voucher.findOne({
        _id: { $ne: id },
        code: voucherData.code
      }).exec();

      if (duplicated) {
        return res.status(400).json({
          success: false,
          message: 'Mã voucher đã tồn tại'
        });
      }

      const updated = await Models.Voucher.findByIdAndUpdate(
        id,
        {
          ...voucherData,
          udate: Date.now()
        },
        { new: true }
      ).exec();

      res.json({
        success: true,
        message: 'Cập nhật voucher thành công',
        voucher: updated
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.put(
  '/vouchers/:id/status',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin']),
  async function (req, res) {
    try {
      const id = req.params.id;

      const oldVoucher = await Models.Voucher.findById(id).exec();
      if (!oldVoucher) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy voucher'
        });
      }

      const isActive = toBoolean(req.body?.isActive, oldVoucher.isActive);

      const updated = await Models.Voucher.findByIdAndUpdate(
        id,
        {
          isActive,
          udate: Date.now()
        },
        { new: true }
      ).exec();

      res.json({
        success: true,
        message: 'Cập nhật trạng thái voucher thành công',
        voucher: updated
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.delete(
  '/vouchers/:id',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin']),
  async function (req, res) {
    try {
      const id = req.params.id;

      const oldVoucher = await Models.Voucher.findById(id).exec();
      if (!oldVoucher) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy voucher'
        });
      }

      await Models.Voucher.findByIdAndDelete(id).exec();

      res.json({
        success: true,
        message: 'Xóa voucher thành công'
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

// =========================
// products
// =========================
router.get(
  '/products',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const products =
        typeof ProductDAO.selectAll === 'function'
          ? await ProductDAO.selectAll()
          : await Models.Product.find({}).sort({ cdate: -1 }).exec();

      res.json({
        success: true,
        products: products
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

router.get(
  '/products/inventory/low-stock',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const products =
        typeof ProductDAO.selectAll === 'function'
          ? await ProductDAO.selectAll()
          : await Models.Product.find({}).exec();

      const lowStockProducts = products.filter((item) => Number(item.stock || 0) <= 5);

      res.json({
        success: true,
        products: lowStockProducts
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

router.post(
  '/products',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const body = req.body || {};
      const cid = body.cid || body.categoryId || body.category?._id || body.category;
      const sid = body.sid || body.submenuId || body.submenu?._id || null;

      if (!body.name || !cid) {
        return res.json({
          success: false,
          message: 'Thiếu tên sản phẩm hoặc danh mục'
        });
      }

      const categoryDoc =
        typeof CategoryDAO.selectByID === 'function'
          ? await CategoryDAO.selectByID(cid)
          : await Models.Category.findById(cid).exec();

      if (!categoryDoc) {
        return res.json({
          success: false,
          message: 'Category not found'
        });
      }

      const category = buildCategorySnapshot(categoryDoc);

      let submenu = null;
      if (sid && Array.isArray(category.submenus)) {
        const foundSubmenu =
          category.submenus.find((s) => String(s._id) === String(sid)) || null;
        submenu = buildSubmenuSnapshot(foundSubmenu);
      }

      const productData = {
        name: String(body.name || '').trim(),
        price: toNumber(body.price, 0),
        image: body.image || '',
        cdate: Date.now(),
        udate: Date.now(),
        description: body.description || '',
        category: category,
        submenu: submenu,
        discountPercent: toNumber(body.discountPercent, 0),
        discountPrice:
          body.discountPrice !== undefined &&
          body.discountPrice !== null &&
          body.discountPrice !== ''
            ? toNumber(body.discountPrice, 0)
            : null,
        stock: toNumber(body.stock, 0),
        sold: toNumber(body.sold, 0)
      };

      let result = null;
      if (typeof ProductDAO.insert === 'function') {
        result = await ProductDAO.insert(productData);
      } else {
        result = await Models.Product.create({
          _id: new mongoose.Types.ObjectId(),
          ...productData
        });
      }

      res.json({
        success: true,
        message: 'Thêm sản phẩm thành công',
        product: result
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

router.put(
  '/products/:id',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const id = req.params.id;
      const body = req.body || {};
      const cid = body.cid || body.categoryId || body.category?._id || body.category;
      const sid = body.sid || body.submenuId || body.submenu?._id || null;

      const oldProduct =
        typeof ProductDAO.selectByID === 'function'
          ? await ProductDAO.selectByID(id)
          : await Models.Product.findById(id).exec();

      if (!oldProduct) {
        return res.json({
          success: false,
          message: 'Product not found'
        });
      }

      let category = oldProduct.category;
      let submenu = oldProduct.submenu || null;

      if (cid) {
        const categoryFromDb =
          typeof CategoryDAO.selectByID === 'function'
            ? await CategoryDAO.selectByID(cid)
            : await Models.Category.findById(cid).exec();

        if (!categoryFromDb) {
          return res.json({
            success: false,
            message: 'Category not found'
          });
        }

        category = buildCategorySnapshot(categoryFromDb);
        submenu = null;

        if (sid && Array.isArray(category.submenus)) {
          const foundSubmenu =
            category.submenus.find((s) => String(s._id) === String(sid)) || null;
          submenu = buildSubmenuSnapshot(foundSubmenu);
        }
      }

      const updateData = {
        name: body.name !== undefined ? String(body.name || '').trim() : oldProduct.name,
        price: body.price !== undefined ? toNumber(body.price, 0) : oldProduct.price,
        image: body.image !== undefined ? body.image : oldProduct.image,
        description:
          body.description !== undefined ? body.description : oldProduct.description,
        category: category,
        submenu: submenu,
        discountPercent:
          body.discountPercent !== undefined
            ? toNumber(body.discountPercent, 0)
            : oldProduct.discountPercent,
        discountPrice:
          body.discountPrice !== undefined
            ? body.discountPrice === null || body.discountPrice === ''
              ? null
              : toNumber(body.discountPrice, 0)
            : oldProduct.discountPrice,
        stock:
          body.stock !== undefined
            ? toNumber(body.stock, 0)
            : toNumber(oldProduct.stock, 0),
        sold:
          body.sold !== undefined
            ? toNumber(body.sold, 0)
            : toNumber(oldProduct.sold, 0),
        udate: Date.now()
      };

      let result = null;
      if (typeof ProductDAO.update === 'function') {
        result = await ProductDAO.update(id, updateData);
      } else {
        result = await Models.Product.findByIdAndUpdate(id, updateData, { new: true }).exec();
      }

      res.json({
        success: true,
        message: 'Cập nhật sản phẩm thành công',
        product: result
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

router.put(
  '/products/:id/stock',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const _id = req.params.id;
      const { action, quantity, stock } = req.body || {};

      const product = await ProductDAO.selectByID(_id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy sản phẩm'
        });
      }

      let updatedProduct = null;

      if (stock !== undefined && stock !== null && stock !== '') {
        updatedProduct = await ProductDAO.setStock(_id, Number(stock));
        return res.json({
          success: true,
          message: 'Đặt lại tồn kho thành công',
          product: updatedProduct
        });
      }

      if (action === 'increase') {
        const qty = Number(quantity || 0);
        if (qty <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Số lượng nhập phải lớn hơn 0'
          });
        }

        updatedProduct = await ProductDAO.increaseStock(_id, qty);
        return res.json({
          success: true,
          message: 'Nhập thêm kho thành công',
          product: updatedProduct
        });
      }

      if (action === 'decrease') {
        const qty = Number(quantity || 0);
        if (qty <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Số lượng trừ phải lớn hơn 0'
          });
        }

        updatedProduct = await ProductDAO.decreaseStock(_id, qty);
        return res.json({
          success: true,
          message: 'Trừ kho thành công',
          product: updatedProduct
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Dữ liệu cập nhật kho không hợp lệ'
      });
    } catch (err) {
      console.error('PRODUCT STOCK UPDATE ERROR:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Lỗi cập nhật kho'
      });
    }
  }
);

router.delete(
  '/products/:id',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const id = req.params.id;

      if (typeof ProductDAO.delete === 'function') {
        await ProductDAO.delete(id);
      } else {
        await Models.Product.findByIdAndDelete(id).exec();
      }

      res.json({
        success: true,
        message: 'Xóa sản phẩm thành công'
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// =========================
// customers
// =========================
router.get(
  '/customers',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const customers =
        typeof CustomerDAO.selectAll === 'function'
          ? await CustomerDAO.selectAll()
          : await Models.Customer.find({}).exec();

      res.json({
        success: true,
        customers: customers
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

router.put(
  '/customers/:id/status',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin']),
  async function (req, res) {
    try {
      const id = req.params.id;
      const active = Number(req.body.active);

      if (![1, 0, -1].includes(active)) {
        return res.status(400).json({
          success: false,
          message: 'Trạng thái tài khoản không hợp lệ'
        });
      }

      const customer = await Models.Customer.findById(id).exec();
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy khách hàng'
        });
      }

      customer.active = active;
      await customer.save();

      res.json({
        success: true,
        message: 'Cập nhật trạng thái khách hàng thành công',
        customer
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

// =========================
// orders
// =========================
router.get(
  '/orders',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const orders = await OrderDAO.selectAll();
      res.json({
        success: true,
        orders: orders
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

router.put(
  '/orders/:id/status',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const _id = req.params.id;
      const newStatus = String(req.body.status || '').trim().toLowerCase();
      const allowedStatuses = [
        'pending',
        'approved',
        'preparing',
        'delivering',
        'completed',
        'canceled'
      ];

      if (!allowedStatuses.includes(newStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Trạng thái đơn hàng không hợp lệ'
        });
      }

      const order = await Models.Order.findById(_id).exec();
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đơn hàng'
        });
      }

      const oldStatus = String(order.status || '').trim().toLowerCase();

      if (oldStatus === newStatus) {
        return res.json({
          success: true,
          message: 'Trạng thái đơn hàng không thay đổi',
          order: order
        });
      }

      if (oldStatus === 'canceled') {
        return res.status(400).json({
          success: false,
          message: 'Đơn hàng đã hủy không thể cập nhật trạng thái nữa'
        });
      }

      if (oldStatus === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Đơn hàng đã hoàn thành không thể đổi sang trạng thái khác'
        });
      }

      if (newStatus === 'completed') {
        for (const item of order.items || []) {
          const productId = item.product?._id;
          const qty = Number(item.quantity || 0);

          const product = await ProductDAO.selectByID(productId);
          if (!product) {
            return res.status(400).json({
              success: false,
              message: 'Không tìm thấy sản phẩm trong đơn hàng'
            });
          }

          if (Number(product.stock || 0) < qty) {
            return res.status(400).json({
              success: false,
              message: `Sản phẩm "${product.name}" không đủ tồn kho`
            });
          }
        }

        for (const item of order.items || []) {
          const productId = item.product?._id;
          const qty = Number(item.quantity || 0);
          await ProductDAO.completeSale(productId, qty);
        }
      }

      if (newStatus === 'canceled' && order.voucherCode) {
        await Models.Voucher.findOneAndUpdate(
          {
            code: normalizeVoucherCode(order.voucherCode),
            usedCount: { $gt: 0 }
          },
          {
            $inc: { usedCount: -1 },
            $set: { udate: Date.now() }
          }
        ).exec();
      }

      order.status = newStatus;
      order.udate = Date.now();

      const savedOrder = await order.save();

      return res.json({
        success: true,
        message:
          newStatus === 'canceled'
            ? 'Hủy đơn hàng thành công'
            : 'Cập nhật trạng thái đơn hàng thành công',
        order: savedOrder
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

router.get(
  '/orders/customer/:cid',
  JwtUtil.checkToken,
  JwtUtil.requireRoles(['admin', 'staff']),
  async function (req, res) {
    try {
      const _cid = req.params.cid;
      const orders = await OrderDAO.selectByCustID(_cid);

      res.json({
        success: true,
        orders: orders
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

module.exports = router;