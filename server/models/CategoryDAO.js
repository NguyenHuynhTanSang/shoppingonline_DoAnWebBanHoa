require('../utils/MongooseUtil');
const mongoose = require('mongoose');
const Models = require('./Models');

function toObjectSafe(doc) {
  return doc?.toObject ? doc.toObject() : doc;
}

async function syncCategoryToProducts(categoryDoc) {
  if (!categoryDoc) return;
  const catObj = toObjectSafe(categoryDoc);
  await Models.Product.updateMany(
    { 'category._id': catObj._id },
    { $set: { category: catObj } }
  ).exec();
}

const CategoryDAO = {
  async selectAll() {
    return Models.Category.find({}).exec();
  },

  async selectByID(_id) {
    return Models.Category.findById(_id).exec();
  },

  async insert(category) {
    category._id = new mongoose.Types.ObjectId();

    if (Array.isArray(category.submenus)) {
      category.submenus = category.submenus.map(sm => ({
        _id: sm?._id ? new mongoose.Types.ObjectId(sm._id) : new mongoose.Types.ObjectId(),
        name: sm?.name
      }));
    }

    return Models.Category.create(category);
  },

  async update(category) {
    const updatePayload = {};
    if (category.name !== undefined) updatePayload.name = category.name;

    if (Array.isArray(category.submenus)) {
      updatePayload.submenus = category.submenus.map(sm => ({
        _id: sm?._id ? new mongoose.Types.ObjectId(sm._id) : new mongoose.Types.ObjectId(),
        name: sm?.name
      }));
    }

    const updated = await Models.Category.findByIdAndUpdate(
      category._id,
      updatePayload,
      { new: true }
    ).exec();

    await syncCategoryToProducts(updated);
    return updated;
  },

  async delete(_id) {
    const deleted = await Models.Category.findByIdAndRemove(_id).exec();
    await Models.Product.deleteMany({ 'category._id': _id }).exec();

    return deleted;
  },

  async addSubmenu(categoryId, submenuName) {
    const submenu = { _id: new mongoose.Types.ObjectId(), name: submenuName };

    const updated = await Models.Category.findByIdAndUpdate(
      categoryId,
      { $push: { submenus: submenu } },
      { new: true }
    ).exec();

    await syncCategoryToProducts(updated);
    return updated;
  },

  async updateSubmenu(categoryId, submenuId, newName) {
    const updated = await Models.Category.findOneAndUpdate(
      { _id: categoryId, 'submenus._id': submenuId },
      { $set: { 'submenus.$.name': newName } },
      { new: true }
    ).exec();

    await syncCategoryToProducts(updated);

    if (updated) {
      await Models.Product.updateMany(
        { 'submenu._id': submenuId },
        { $set: { 'submenu.name': newName } }
      ).exec();
    }

    return updated;
  },

  async deleteSubmenu(categoryId, submenuId) {
    const updated = await Models.Category.findByIdAndUpdate(
      categoryId,
      { $pull: { submenus: { _id: submenuId } } },
      { new: true }
    ).exec();

    await syncCategoryToProducts(updated);

    await Models.Product.updateMany(
      { 'submenu._id': submenuId },
      { $set: { submenu: null } }
    ).exec();

    return updated;
  }
};

module.exports = CategoryDAO;