require('../utils/MongooseUtil');
const mongoose = require('mongoose');
const Models = require('./Models');

const ProductDAO = {
  async selectByCount() {
    return Models.Product.countDocuments({}).exec();
  },

  async selectBySkipLimit(skip, limit) {
    const sortByDate = { cdate: -1 };
    return Models.Product.find({})
      .sort(sortByDate)
      .skip(skip)
      .limit(limit)
      .exec();
  },

  async selectAll() {
    return Models.Product.find({}).exec();
  },

  async insert(product) {
    product._id = new mongoose.Types.ObjectId();
    product.cdate = product.cdate ?? Date.now();
    product.udate = product.udate ?? product.cdate;

    if (product.discountPercent === undefined || product.discountPercent === null) {
      product.discountPercent = 0;
    }
    if (product.discountPrice === undefined) {
      product.discountPrice = null;
    }

    if (product.stock === undefined || product.stock === null) {
      product.stock = 0;
    }
    if (product.sold === undefined || product.sold === null) {
      product.sold = 0;
    }

    return Models.Product.create(product);
  },

  async selectByID(_id) {
    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return null;
    }
    return Models.Product.findById(_id).exec();
  },

  async update(_id, product) {
    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return null;
    }

    const updatePayload = {
      name: product.name,
      price: product.price,
      image: product.image,
      description: product.description,
      category: product.category,
      submenu: product.submenu ?? null,
      discountPercent: product.discountPercent ?? 0,
      discountPrice: product.discountPrice === undefined ? null : product.discountPrice,
      stock: product.stock ?? 0,
      sold: product.sold ?? 0,
      cdate: product.cdate,
      udate: product.udate ?? Date.now()
    };

    return Models.Product.findByIdAndUpdate(_id, updatePayload, { new: true }).exec();
  },

  async delete(_id) {
    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return null;
    }
    return Models.Product.findByIdAndRemove(_id).exec();
  },

  async selectTopNew(top) {
    const mysort = { cdate: -1 };
    return Models.Product.find({}).sort(mysort).limit(top).exec();
  },

  async selectTopHot(top) {
    const items = await Models.Order.aggregate([
      {
        $match: {
          status: { $in: ['approved', 'completed', 'APPROVED', 'COMPLETED'] }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product._id',
          sum: { $sum: '$items.quantity' }
        }
      },
      { $sort: { sum: -1 } },
      { $limit: top }
    ]).exec();

    const products = [];
    for (const item of items) {
      if (!item._id || !mongoose.Types.ObjectId.isValid(item._id)) continue;
      const p = await Models.Product.findById(item._id).exec();
      if (p) products.push(p);
    }
    return products;
  },

  async selectByCatID(_cid) {
    return Models.Product.find({ 'category._id': _cid }).exec();
  },

  async selectBySubmenuID(_sid) {
    return Models.Product.find({ 'submenu._id': _sid }).exec();
  },

  async selectByKeyword(keyword) {
    try {
      const regex = new RegExp(keyword, 'i');
      const query = {
        $or: [
          { name: { $regex: regex } },
          { description: { $regex: regex } },
          { 'category.name': { $regex: regex } },
          { 'submenu.name': { $regex: regex } }
        ]
      };
      return await Models.Product.find(query).exec();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  // =========================
  // KHO
  // =========================

  async increaseStock(_id, quantity) {
    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      throw new Error('ID sản phẩm không hợp lệ');
    }

    const qty = Number(quantity || 0);
    if (qty <= 0) {
      throw new Error('Số lượng nhập phải lớn hơn 0');
    }

    return Models.Product.findByIdAndUpdate(
      _id,
      {
        $inc: { stock: qty },
        $set: { udate: Date.now() }
      },
      { new: true }
    ).exec();
  },

  async decreaseStock(_id, quantity) {
    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      throw new Error('ID sản phẩm không hợp lệ');
    }

    const qty = Number(quantity || 0);
    if (qty <= 0) {
      throw new Error('Số lượng trừ phải lớn hơn 0');
    }

    const product = await Models.Product.findById(_id).exec();
    if (!product) {
      throw new Error('Không tìm thấy sản phẩm');
    }

    const currentStock = Number(product.stock || 0);
    if (currentStock < qty) {
      throw new Error('Không thể trừ vượt quá tồn kho hiện tại');
    }

    product.stock = currentStock - qty;
    product.udate = Date.now();

    return await product.save();
  },

  async setStock(_id, stock) {
    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      throw new Error('ID sản phẩm không hợp lệ');
    }

    const newStock = Number(stock);
    if (!Number.isFinite(newStock) || newStock < 0) {
      throw new Error('Tồn kho không hợp lệ');
    }

    return Models.Product.findByIdAndUpdate(
      _id,
      {
        $set: {
          stock: newStock,
          udate: Date.now()
        }
      },
      { new: true }
    ).exec();
  },

  // dùng khi đơn hoàn thành
  async completeSale(_id, quantity) {
    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      throw new Error('ID sản phẩm không hợp lệ');
    }

    const qty = Number(quantity || 0);
    if (qty <= 0) {
      throw new Error('Số lượng bán phải lớn hơn 0');
    }

    const product = await Models.Product.findById(_id).exec();
    if (!product) {
      throw new Error('Không tìm thấy sản phẩm');
    }

    const currentStock = Number(product.stock || 0);
    const currentSold = Number(product.sold || 0);

    if (currentStock < qty) {
      throw new Error(`Sản phẩm "${product.name}" không đủ tồn kho`);
    }

    product.stock = currentStock - qty;
    product.sold = currentSold + qty;
    product.udate = Date.now();

    return await product.save();
  }
};

module.exports = ProductDAO;