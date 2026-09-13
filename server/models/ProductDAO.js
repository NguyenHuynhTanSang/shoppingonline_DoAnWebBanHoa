require('../utils/MongooseUtil');

const mongoose = require('mongoose');
const Models = require('./Models');

const ProductDAO = {
  // Only this allowlisted contract may cross the AI tool boundary.
  async searchForAssistant(input = {}) {
    const invalid = () => {
      const error = new Error('Invalid product search input');
      error.code = 'INVALID_PRODUCT_SEARCH_INPUT';
      return error;
    };

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))
    ) {
      throw invalid();
    }

    const allowed = [
      'keyword',
      'keywords',
      'excludeIds',
      'category',
      'minPrice',
      'maxPrice',
      'availability',
      'inStockOnly',
      'limit'
    ];

    if (Reflect.ownKeys(input).some(key => !allowed.includes(key))) {
      throw invalid();
    }

    const {
      keyword,
      category,
      minPrice,
      maxPrice,
      inStockOnly,
      limit = 5
    } = input;

    if (
      input.keywords !== undefined &&
      (
        !Array.isArray(input.keywords) ||
        input.keywords.length < 1 ||
        input.keywords.length > 6 ||
        input.keywords.some(
          value =>
            typeof value !== 'string' ||
            !value.trim() ||
            value.length > 200
        ) ||
        keyword !== undefined
      )
    ) {
      throw invalid();
    }

    if (
      inStockOnly !== undefined &&
      typeof inStockOnly !== 'boolean'
    ) {
      throw invalid();
    }

    if (
      inStockOnly !== undefined &&
      input.availability !== undefined
    ) {
      throw invalid();
    }

    const availability =
      input.availability === undefined
        ? (inStockOnly === false ? 'all' : 'in_stock')
        : input.availability;

    for (const value of [keyword, category]) {
      if (
        value !== undefined &&
        (
          typeof value !== 'string' ||
          !value.trim() ||
          value.length > 200
        )
      ) {
        throw invalid();
      }
    }

    if (
      category !== undefined &&
      !/^[a-fA-F0-9]{24}$/.test(category)
    ) {
      throw invalid();
    }

    for (const value of [minPrice, maxPrice]) {
      if (
        value !== undefined &&
        (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < 0
        )
      ) {
        throw invalid();
      }
    }

    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw invalid();
    }

    if (
      !['in_stock', 'out_of_stock', 'all'].includes(availability)
    ) {
      throw invalid();
    }

    if (
      !Number.isSafeInteger(limit) ||
      limit < 1
    ) {
      throw invalid();
    }

    const filter = {};

    if (input.excludeIds !== undefined) {
      if (
        !Array.isArray(input.excludeIds) ||
        input.excludeIds.length > 4 ||
        input.excludeIds.some(
          id =>
            typeof id !== 'string' ||
            !/^[a-f\d]{24}$/i.test(id)
        )
      ) {
        throw invalid();
      }

      filter._id = {
        $nin: input.excludeIds.map(
          id => new mongoose.Types.ObjectId(id)
        )
      };
    }

    if (input.keywords) {
      filter.$and = input.keywords.map(value => {
        const regex = new RegExp(
          value
            .trim()
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i'
        );

        return {
          $or: [
            'name',
            'description',
            'category.name',
            'submenu.name'
          ].map(field => ({
            [field]: { $regex: regex }
          }))
        };
      });
    }

    if (keyword !== undefined) {
      const literal = keyword
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const regex = new RegExp(literal, 'i');

      filter.$or = [
        'name',
        'description',
        'category.name',
        'submenu.name'
      ].map(field => ({
        [field]: { $regex: regex }
      }));
    }

    if (category !== undefined) {
      filter['category._id'] =
        new mongoose.Types.ObjectId(category);
    }

    if (
      minPrice !== undefined ||
      maxPrice !== undefined
    ) {
      filter.price = {};

      if (minPrice !== undefined) {
        filter.price.$gte = minPrice;
      }

      if (maxPrice !== undefined) {
        filter.price.$lte = maxPrice;
      }
    }

    if (availability === 'in_stock') {
      filter.stock = { $gt: 0 };
    }

    if (availability === 'out_of_stock') {
      filter.stock = { $lte: 0 };
    }

    return Models.Product.find(filter)
      .select(
        '_id name price image description ' +
        'category._id category.name ' +
        'submenu._id submenu.name stock'
      )
      .sort({ _id: 1 })
      .limit(Math.min(limit, 5))
      .maxTimeMS(3000)
      .lean()
      .exec();
  },

  async selectByCount() {
    return Models.Product
      .countDocuments({})
      .exec();
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
    return Models.Product
      .find({})
      .exec();
  },

  async insert(product) {
    product._id =
      new mongoose.Types.ObjectId();

    product.cdate =
      product.cdate ?? Date.now();

    product.udate =
      product.udate ?? product.cdate;

    if (
      product.discountPercent === undefined ||
      product.discountPercent === null
    ) {
      product.discountPercent = 0;
    }

    if (
      product.discountPrice === undefined
    ) {
      product.discountPrice = null;
    }

    if (
      product.stock === undefined ||
      product.stock === null
    ) {
      product.stock = 0;
    }

    if (
      product.sold === undefined ||
      product.sold === null
    ) {
      product.sold = 0;
    }

    return Models.Product.create(product);
  },

  async selectByID(_id, session) {
    if (
      !_id ||
      !mongoose.Types.ObjectId.isValid(_id)
    ) {
      return null;
    }

    return Models.Product
      .findById(_id)
      .session(session || null)
      .exec();
  },

  async update(_id, product) {
    if (
      !_id ||
      !mongoose.Types.ObjectId.isValid(_id)
    ) {
      return null;
    }

    const updatePayload = {
      name: product.name,
      price: product.price,
      image: product.image,
      description: product.description,
      category: product.category,
      submenu: product.submenu ?? null,
      discountPercent:
        product.discountPercent ?? 0,
      discountPrice:
        product.discountPrice === undefined
          ? null
          : product.discountPrice,
      stock: product.stock ?? 0,
      sold: product.sold ?? 0,
      cdate: product.cdate,
      udate:
        product.udate ?? Date.now()
    };

    return Models.Product
      .findByIdAndUpdate(
        _id,
        updatePayload,
        { new: true }
      )
      .exec();
  },

  async delete(_id) {
    if (
      !_id ||
      !mongoose.Types.ObjectId.isValid(_id)
    ) {
      return null;
    }

    return Models.Product
      .findByIdAndRemove(_id)
      .exec();
  },

  async selectTopNew(top) {
    const mysort = { cdate: -1 };

    return Models.Product
      .find({})
      .sort(mysort)
      .limit(top)
      .exec();
  },

  async selectTopHot(top) {
    const items = await Models.Order.aggregate([
      {
        $match: {
          status: {
            $in: [
              'approved',
              'completed',
              'APPROVED',
              'COMPLETED'
            ]
          }
        }
      },

      {
        $unwind: '$items'
      },

      {
        $group: {
          _id: '$items.product._id',
          sum: {
            $sum: '$items.quantity'
          }
        }
      },

      {
        $sort: {
          sum: -1
        }
      },

      {
        $limit: top
      }
    ]).exec();

    const products = [];

    for (const item of items) {
      if (
        !item._id ||
        !mongoose.Types.ObjectId.isValid(
          item._id
        )
      ) {
        continue;
      }

      const p = await Models.Product
        .findById(item._id)
        .exec();

      if (p) {
        products.push(p);
      }
    }

    return products;
  },

  async selectByCatID(_cid) {
    return Models.Product
      .find({
        'category._id': _cid
      })
      .exec();
  },

  async selectBySubmenuID(_sid) {
    return Models.Product
      .find({
        'submenu._id': _sid
      })
      .exec();
  },

  async selectByKeyword(keyword) {
    try {
      const regex =
        new RegExp(keyword, 'i');

      const query = {
        $or: [
          {
            name: {
              $regex: regex
            }
          },
          {
            description: {
              $regex: regex
            }
          },
          {
            'category.name': {
              $regex: regex
            }
          },
          {
            'submenu.name': {
              $regex: regex
            }
          }
        ]
      };

      return await Models.Product
        .find(query)
        .exec();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  // =========================
  // KHO
  // =========================

  async increaseStock(_id, quantity) {
    if (
      !_id ||
      !mongoose.Types.ObjectId.isValid(_id)
    ) {
      throw new Error(
        'ID sản phẩm không hợp lệ'
      );
    }

    const qty =
      Number(quantity || 0);

    if (qty <= 0) {
      throw new Error(
        'Số lượng nhập phải lớn hơn 0'
      );
    }

    return Models.Product
      .findByIdAndUpdate(
        _id,
        {
          $inc: {
            stock: qty
          },
          $set: {
            udate: Date.now()
          }
        },
        {
          new: true
        }
      )
      .exec();
  },

  async decreaseStock(_id, quantity) {
    if (
      !_id ||
      !mongoose.Types.ObjectId.isValid(_id)
    ) {
      throw new Error(
        'ID sản phẩm không hợp lệ'
      );
    }

    const qty =
      Number(quantity || 0);

    if (qty <= 0) {
      throw new Error(
        'Số lượng trừ phải lớn hơn 0'
      );
    }

    const product =
      await Models.Product
        .findById(_id)
        .exec();

    if (!product) {
      throw new Error(
        'Không tìm thấy sản phẩm'
      );
    }

    const currentStock =
      Number(product.stock || 0);

    if (currentStock < qty) {
      throw new Error(
        'Không thể trừ vượt quá tồn kho hiện tại'
      );
    }

    product.stock =
      currentStock - qty;

    product.udate =
      Date.now();

    return await product.save();
  },

  async setStock(_id, stock) {
    if (
      !_id ||
      !mongoose.Types.ObjectId.isValid(_id)
    ) {
      throw new Error(
        'ID sản phẩm không hợp lệ'
      );
    }

    const newStock =
      Number(stock);

    if (
      !Number.isFinite(newStock) ||
      newStock < 0
    ) {
      throw new Error(
        'Tồn kho không hợp lệ'
      );
    }

    return Models.Product
      .findByIdAndUpdate(
        _id,
        {
          $set: {
            stock: newStock,
            udate: Date.now()
          }
        },
        {
          new: true
        }
      )
      .exec();
  },

  // dùng khi đơn hoàn thành
  async reserveStock(_id, quantity, session) {
    return this.updateInventory(_id, quantity, session, { stock: { $gte: quantity } }, { stock: -quantity });
  },

  async releaseStock(_id, quantity, session) {
    return this.updateInventory(_id, quantity, session, {}, { stock: quantity });
  },

  async incrementSold(_id, quantity, session) {
    return this.updateInventory(_id, quantity, session, {}, { sold: quantity });
  },

  async updateInventory(_id, quantity, session, filter, increments) {
    if (!mongoose.Types.ObjectId.isValid(_id) || !Number.isSafeInteger(quantity) || quantity <= 0 || !session?.inTransaction()) {
      throw new Error('Invalid transactional inventory operation');
    }
    return Models.Product.findOneAndUpdate(
      { _id, ...filter },
      { $inc: increments, $set: { udate: Date.now() } },
      { new: true, session }
    ).exec();
  },

  // Compatibility name: completion now counts sold only, inside the lifecycle transaction.
  async completeSale(_id, quantity, session) {
    return this.incrementSold(_id, quantity, session);
  }
};

module.exports = ProductDAO;
