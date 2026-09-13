const ProductDAO = require('../../../models/ProductDAO');

const DESCRIPTION_LIMIT = 600;

function cleanOptionalText(
  value,
  limit = DESCRIPTION_LIMIT
) {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();

  return text
    ? text.slice(0, limit)
    : null;
}

async function searchProducts(
  input = {}
) {
  let products;

  try {
    products =
      await ProductDAO.searchForAssistant(
        input
      );
  } catch (error) {
    if (
      error.code ===
      'INVALID_PRODUCT_SEARCH_INPUT'
    ) {
      throw error;
    }

    const unavailable =
      new Error(
        'Product search is unavailable'
      );

    unavailable.code =
      'PRODUCT_SEARCH_UNAVAILABLE';

    throw unavailable;
  }

  /*
   * Không cho AI invent price/stock
   * nếu legacy record thiếu dữ liệu.
   */
  return products
    .filter(product =>
      product._id &&
      typeof product.name === 'string' &&
      product.name.trim() &&
      Number.isFinite(product.price) &&
      product.price >= 0 &&
      Number.isFinite(product.stock) &&
      product.stock >= 0
    )
    .map(product => ({
      id: String(product._id),

      name:
        product.name.trim(),

      price:
        product.price,

      image:
        typeof product.image === 'string'
          ? product.image
          : null,

      category:
        product.category
          ? {
              id:
                product.category._id
                  ? String(
                      product.category._id
                    )
                  : null,

              name:
                product.category.name ||
                null
            }
          : null,

      /*
       * Chuẩn bị cho Smart Recommendation.
       *
       * Hiện ProductDAO cần select thêm
       * submenu + description thì hai field này
       * mới có dữ liệu trong search result.
       */
      submenu:
        product.submenu
          ? {
              id:
                product.submenu._id
                  ? String(
                      product.submenu._id
                    )
                  : null,

              name:
                product.submenu.name ||
                null
            }
          : null,

      description:
        cleanOptionalText(
          product.description
        ),

      stock:
        product.stock
    }));
}

async function getProduct(id) {
  if (
    typeof id !== 'string' ||
    !/^[a-f\d]{24}$/i.test(id)
  ) {
    return null;
  }

  let product;

  try {
    product =
      await ProductDAO.selectByID(id);
  } catch {
    const error =
      new Error(
        'Product search is unavailable'
      );

    error.code =
      'PRODUCT_SEARCH_UNAVAILABLE';

    throw error;
  }

  if (
    !product ||
    typeof product.name !== 'string' ||
    !product.name.trim() ||
    !Number.isFinite(product.price) ||
    product.price < 0 ||
    !Number.isFinite(product.stock) ||
    product.stock < 0
  ) {
    return null;
  }

  return {
    id:
      String(product._id),

    name:
      product.name.trim(),

    price:
      product.price,

    stock:
      product.stock,

    image:
      typeof product.image === 'string'
        ? product.image
        : null,

    /*
     * Giữ category dạng string ở getProduct
     * để không phá contract cũ.
     */
    category:
      product.category?.name ||
      null,

    submenu:
      product.submenu?.name ||
      null,

    description:
      cleanOptionalText(
        product.description
      )
  };
}

module.exports = {
  searchProducts,
  getProduct
};