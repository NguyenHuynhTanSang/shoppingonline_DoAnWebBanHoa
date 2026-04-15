require('./utils/MongooseUtil');
const mongoose = require('mongoose');
const Models = require('./models/Models');
const products = require('../client-customer/src/data/products').default;

// map slug -> tên hiển thị đẹp hơn
const CATEGORY_NAME_MAP = {
  'bo-hoa-8-3': 'Bó hoa 8-3',
  'gio-hoa-8-3': 'Giỏ hoa 8-3',
  'binh-hoa-8-3': 'Bình hoa 8-3',
  'tulip': 'Hoa tulip',
  'hoa-hong': 'Hoa hồng',
  'hoa-huong-duong': 'Hoa hướng dương',
  'hoa-cat-tuong': 'Hoa cát tường',
  'hoa-lan-ho-diep': 'Hoa lan hồ điệp'
};

function getCategoryDisplayName(slug) {
  return CATEGORY_NAME_MAP[slug] || slug || 'Khác';
}

function normalizeImage(image) {
  return String(image || '').trim();
}

async function waitForMongo() {
  if (mongoose.connection.readyState === 1) return;

  await new Promise((resolve, reject) => {
    mongoose.connection.once('open', resolve);
    mongoose.connection.once('error', reject);
  });
}

async function seedProducts() {
  try {
    await waitForMongo();

    console.log('Đã kết nối MongoDB, bắt đầu seed dữ liệu...');

    // 1) Lấy danh sách categorySlug duy nhất từ products.js
    const uniqueSlugs = [...new Set(
      products
        .map(item => String(item.categorySlug || '').trim())
        .filter(Boolean)
    )];

    console.log(`Tìm thấy ${uniqueSlugs.length} category từ products.js`);

    // 2) XÓA category cũ thuộc bộ dữ liệu này để seed lại sạch
    // Nếu bạn đang có categories làm tay khác ngoài bộ này thì backup trước
    const categoryNamesToReset = uniqueSlugs.map(getCategoryDisplayName);

    console.log('Đang xoá products cũ...');
    await Models.Product.deleteMany({});

    console.log('Đang xoá categories cũ thuộc bộ seed này...');
    await Models.Category.deleteMany({
      name: { $in: categoryNamesToReset }
    });

    // 3) Tạo lại categories mới
    const categoryMap = new Map();

    for (const slug of uniqueSlugs) {
      const categoryDoc = {
        _id: new mongoose.Types.ObjectId(),
        name: getCategoryDisplayName(slug),
        submenus: []
      };

      const insertedCategory = await Models.Category.create(categoryDoc);
      categoryMap.set(slug, insertedCategory);

      console.log(`Đã tạo category: ${insertedCategory.name}`);
    }

    // 4) Tạo docs sản phẩm mới
    const now = Date.now();

    const docs = products.map((item) => {
      const slug = String(item.categorySlug || '').trim();
      const category = categoryMap.get(slug);

      if (!category) {
        throw new Error(`Không tìm thấy category cho slug: ${slug}`);
      }

      return {
        _id: new mongoose.Types.ObjectId(),
        name: String(item.name || '').trim(),
        price: Number(item.price || 0),
        image: normalizeImage(item.image),
        description: String(item.description || '').trim(),
        cdate: now,
        udate: now,

        category: {
          _id: category._id,
          name: category.name
        },

        submenu: null,
        discountPercent: 0,
        discountPrice: null,
        stock: 100,
        sold: 0
      };
    });

    // 5) Insert lại toàn bộ product
    await Models.Product.insertMany(docs);

    console.log('====================================');
    console.log(`Seed thành công ${docs.length} sản phẩm.`);
    console.log(`Seed thành công ${uniqueSlugs.length} category.`);
    console.log('Hoàn tất.');
    console.log('====================================');

    process.exit(0);
  } catch (err) {
    console.error('Seed lỗi:', err);
    process.exit(1);
  }
}

seedProducts();