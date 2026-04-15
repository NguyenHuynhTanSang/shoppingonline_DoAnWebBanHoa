import React, { useCallback, useEffect, useMemo, useState } from 'react';
import LayoutComponent from '../components/LayoutComponent';
import API from '../services/api';

const DEFAULT_NEW_PRODUCT = {
  name: '',
  price: '',
  image: '',
  description: '',
  categoryId: '',
  submenuId: '',
  stock: 100,
  sold: 0,
  discountPercent: 0,
  discountPrice: ''
};

const DEFAULT_EDIT_PRODUCT = {
  _id: '',
  name: '',
  price: '',
  image: '',
  description: '',
  categoryId: '',
  submenuId: '',
  stock: 0,
  sold: 0,
  discountPercent: 0,
  discountPrice: ''
};

function parseMoneyInput(value) {
  const raw = String(value ?? '').trim();

  if (!raw) return NaN;

  let cleaned = raw.replace(/\s/g, '').replace(/đ|vnd/gi, '');
  cleaned = cleaned.replace(/[.,]/g, '');

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : NaN;
}

function ProductAdminComponent() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [adjustments, setAdjustments] = useState({});
  const [classificationEdits, setClassificationEdits] = useState({});

  const [searchText, setSearchText] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('stockAsc');

  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [newProduct, setNewProduct] = useState(DEFAULT_NEW_PRODUCT);

  const [showEditForm, setShowEditForm] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editProduct, setEditProduct] = useState(DEFAULT_EDIT_PRODUCT);

  const getFallbackImage = () => `${window.location.origin}/images/no-image.png`;

  const getImageSrc = (image) => {
    const value = String(image || '').trim();
    if (!value) return getFallbackImage();

    if (value.startsWith('data:image')) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;

    const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');

    if (!normalized) return getFallbackImage();

    if (normalized.startsWith('images/')) {
      return `${window.location.origin}/${encodeURI(normalized)}`;
    }

    if (
      normalized.startsWith('uploads/') ||
      normalized.startsWith('assets/') ||
      normalized.startsWith('public/')
    ) {
      return `${window.location.origin}/${encodeURI(normalized)}`;
    }

    const isFileNameOnly =
      !normalized.includes('/') &&
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(normalized);

    if (isFileNameOnly) {
      return `${window.location.origin}/images/${encodeURI(normalized)}`;
    }

    const looksLikeBase64 = /^[A-Za-z0-9+/=]+$/.test(normalized) && normalized.length > 100;
    if (looksLikeBase64) {
      return `data:image/jpeg;base64,${normalized}`;
    }

    return `${window.location.origin}/${encodeURI(normalized)}`;
  };

  const handleImageError = (e) => {
    const fallback = getFallbackImage();

    if (e.currentTarget.dataset.fallbackApplied === 'true') return;

    e.currentTarget.dataset.fallbackApplied = 'true';
    e.currentTarget.src = fallback;
  };

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/products');

      if (res.data && res.data.success) {
        const data = res.data.products || [];
        setProducts(data);

        const initAdjustments = {};
        const initClassification = {};

        data.forEach((item) => {
          initAdjustments[item._id] = {
            quantity: 1,
            stock: Number(item.stock || 0)
          };

          initClassification[item._id] = {
            categoryId: item.category?._id || '',
            submenuId: item.submenu?._id || ''
          };
        });

        setAdjustments(initAdjustments);
        setClassificationEdits(initClassification);
        setMessage('');
      } else {
        setProducts([]);
        setMessage(res.data?.message || 'Không thể tải danh sách sản phẩm');
      }
    } catch (error) {
      console.error(error);
      setMessage('Không thể tải danh sách sản phẩm');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await API.get('/admin/categories');
      if (res.data && res.data.success) {
        setCategories(res.data.categories || []);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error(error);
      setCategories([]);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    await Promise.all([fetchProducts(), fetchCategories()]);
  }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const getStockStatus = (stock) => {
    const qty = Number(stock || 0);
    if (qty <= 0) return 'Hết hàng';
    if (qty <= 5) return 'Sắp hết hàng';
    return 'Còn hàng';
  };

  const getStockClass = (stock) => {
    const qty = Number(stock || 0);
    if (qty <= 0) return 'stock-badge out';
    if (qty <= 5) return 'stock-badge low';
    return 'stock-badge in';
  };

  const resetFilters = () => {
    setSearchText('');
    setStockFilter('all');
    setCategoryFilter('all');
    setSortBy('stockAsc');
  };

  const handleChangeQuantity = (productId, value) => {
    const qty = Math.max(1, Number(value || 1));
    setAdjustments((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        quantity: qty
      }
    }));
  };

  const handleChangeStock = (productId, value) => {
    const stock = Math.max(0, Number(value || 0));
    setAdjustments((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        stock
      }
    }));
  };

  const handleAdjustStock = async (product, action) => {
    try {
      const quantity = Number(adjustments[product._id]?.quantity || 1);

      if (quantity <= 0) {
        alert('Số lượng điều chỉnh phải lớn hơn 0');
        return;
      }

      if (action === 'decrease' && Number(product.stock || 0) < quantity) {
        alert('Không thể trừ vượt quá tồn kho hiện tại');
        return;
      }

      setSavingId(product._id);

      const res = await API.put(`/admin/products/${product._id}/stock`, {
        action,
        quantity
      });

      if (res.data && res.data.success) {
        alert('Cập nhật kho thành công');
        await fetchProducts();
      } else {
        alert(res.data?.message || 'Không thể cập nhật kho');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi cập nhật kho');
    } finally {
      setSavingId('');
    }
  };

  const handleSetStock = async (product) => {
    try {
      const stock = Number(adjustments[product._id]?.stock ?? product.stock ?? 0);

      if (stock < 0) {
        alert('Tồn kho không được âm');
        return;
      }

      setSavingId(product._id);

      const res = await API.put(`/admin/products/${product._id}/stock`, {
        stock
      });

      if (res.data && res.data.success) {
        alert('Đặt lại tồn kho thành công');
        await fetchProducts();
      } else {
        alert(res.data?.message || 'Không thể đặt lại tồn kho');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi đặt lại tồn kho');
    } finally {
      setSavingId('');
    }
  };

  const handleChangeCategory = (productId, categoryId) => {
    setClassificationEdits((prev) => ({
      ...prev,
      [productId]: {
        categoryId,
        submenuId: ''
      }
    }));
  };

  const handleChangeSubmenu = (productId, submenuId) => {
    setClassificationEdits((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        submenuId
      }
    }));
  };

  const getSelectedCategory = (productId) => {
    const categoryId = classificationEdits[productId]?.categoryId || '';
    return categories.find((c) => String(c._id) === String(categoryId)) || null;
  };

  const handleSaveClassification = async (product) => {
    try {
      const edit = classificationEdits[product._id] || {};
      const selectedCategory = categories.find(
        (c) => String(c._id) === String(edit.categoryId)
      );

      if (!selectedCategory) {
        alert('Vui lòng chọn danh mục');
        return;
      }

      setSavingId(product._id);

      const payload = {
        name: product.name,
        price: product.price,
        image: product.image,
        description: product.description,
        discountPercent: product.discountPercent ?? 0,
        discountPrice: product.discountPrice,
        stock: product.stock ?? 0,
        sold: product.sold ?? 0,
        cid: selectedCategory._id,
        sid: edit.submenuId || null
      };

      const res = await API.put(`/admin/products/${product._id}`, payload);

      if (res.data && res.data.success) {
        alert('Cập nhật danh mục / menu con cho sản phẩm thành công');
        await fetchProducts();
      } else {
        alert(res.data?.message || 'Không thể cập nhật phân loại sản phẩm');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi cập nhật phân loại sản phẩm');
    } finally {
      setSavingId('');
    }
  };

  const handleChangeNewProduct = (field, value) => {
    setNewProduct((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();

    const name = String(newProduct.name || '').trim();
    const price = parseMoneyInput(newProduct.price);
    const cid = String(newProduct.categoryId || '').trim();

    if (!name) {
      alert('Vui lòng nhập tên sản phẩm');
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      alert('Giá sản phẩm không hợp lệ');
      return;
    }

    if (!cid) {
      alert('Vui lòng chọn danh mục');
      return;
    }

    try {
      setCreating(true);

      const parsedDiscountPrice =
        String(newProduct.discountPrice || '').trim() === ''
          ? null
          : parseMoneyInput(newProduct.discountPrice);

      if (
        parsedDiscountPrice !== null &&
        (!Number.isFinite(parsedDiscountPrice) || parsedDiscountPrice < 0)
      ) {
        alert('Giá giảm không hợp lệ');
        return;
      }

      const payload = {
        name,
        price,
        image: String(newProduct.image || '').trim(),
        description: String(newProduct.description || '').trim(),
        cid,
        sid: newProduct.submenuId || null,
        stock: Math.max(0, Number(newProduct.stock || 0)),
        sold: Math.max(0, Number(newProduct.sold || 0)),
        discountPercent: Math.max(0, Math.min(100, Number(newProduct.discountPercent || 0))),
        discountPrice: parsedDiscountPrice
      };

      const res = await API.post('/admin/products', payload);

      if (res.data && res.data.success) {
        alert('Thêm sản phẩm thành công');
        setNewProduct(DEFAULT_NEW_PRODUCT);
        setShowAddForm(false);
        await fetchAllData();
      } else {
        alert(res.data?.message || 'Không thể thêm sản phẩm');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi thêm sản phẩm');
    } finally {
      setCreating(false);
    }
  };

  const openEditForm = (product) => {
    setEditProduct({
      _id: product._id,
      name: product.name || '',
      price: product.price || '',
      image: product.image || '',
      description: product.description || '',
      categoryId: product.category?._id || '',
      submenuId: product.submenu?._id || '',
      stock: Number(product.stock || 0),
      sold: Number(product.sold || 0),
      discountPercent: Number(product.discountPercent || 0),
      discountPrice:
        product.discountPrice === null || product.discountPrice === undefined
          ? ''
          : product.discountPrice
    });
    setShowEditForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeEditProduct = (field, value) => {
    setEditProduct((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();

    const name = String(editProduct.name || '').trim();
    const price = parseMoneyInput(editProduct.price);
    const cid = String(editProduct.categoryId || '').trim();

    if (!editProduct._id) {
      alert('Không tìm thấy sản phẩm cần sửa');
      return;
    }

    if (!name) {
      alert('Vui lòng nhập tên sản phẩm');
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      alert('Giá sản phẩm không hợp lệ');
      return;
    }

    if (!cid) {
      alert('Vui lòng chọn danh mục');
      return;
    }

    try {
      setUpdating(true);

      const parsedDiscountPrice =
        String(editProduct.discountPrice || '').trim() === ''
          ? null
          : parseMoneyInput(editProduct.discountPrice);

      if (
        parsedDiscountPrice !== null &&
        (!Number.isFinite(parsedDiscountPrice) || parsedDiscountPrice < 0)
      ) {
        alert('Giá giảm không hợp lệ');
        return;
      }

      const payload = {
        name,
        price,
        image: String(editProduct.image || '').trim(),
        description: String(editProduct.description || '').trim(),
        cid,
        sid: editProduct.submenuId || null,
        stock: Math.max(0, Number(editProduct.stock || 0)),
        sold: Math.max(0, Number(editProduct.sold || 0)),
        discountPercent: Math.max(
          0,
          Math.min(100, Number(editProduct.discountPercent || 0))
        ),
        discountPrice: parsedDiscountPrice
      };

      const res = await API.put(`/admin/products/${editProduct._id}`, payload);

      if (res.data && res.data.success) {
        alert('Cập nhật sản phẩm thành công');
        setShowEditForm(false);
        setEditProduct(DEFAULT_EDIT_PRODUCT);
        await fetchAllData();
      } else {
        alert(res.data?.message || 'Không thể cập nhật sản phẩm');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi cập nhật sản phẩm');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    const ok = window.confirm(`Bạn có chắc muốn xóa sản phẩm "${product.name}" không?`);
    if (!ok) return;

    try {
      setDeletingId(product._id);

      const res = await API.delete(`/admin/products/${product._id}`);

      if (res.data && res.data.success) {
        alert('Xóa sản phẩm thành công');
        await fetchAllData();
      } else {
        alert(res.data?.message || 'Không thể xóa sản phẩm');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Lỗi xóa sản phẩm');
    } finally {
      setDeletingId('');
    }
  };

  const selectedAddCategory = useMemo(() => {
    return categories.find((c) => String(c._id) === String(newProduct.categoryId)) || null;
  }, [categories, newProduct.categoryId]);

  const addFormSubmenus = selectedAddCategory?.submenus || [];

  const selectedEditCategory = useMemo(() => {
    return categories.find((c) => String(c._id) === String(editProduct.categoryId)) || null;
  }, [categories, editProduct.categoryId]);

  const editFormSubmenus = selectedEditCategory?.submenus || [];

  const filteredProducts = useMemo(() => {
    let result = [...products];
    const keyword = searchText.trim().toLowerCase();

    if (keyword) {
      result = result.filter((item) => {
        const id = String(item._id || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        const categoryName = String(item.category?.name || '').toLowerCase();
        const submenuName = String(item.submenu?.name || '').toLowerCase();

        return (
          id.includes(keyword) ||
          name.includes(keyword) ||
          categoryName.includes(keyword) ||
          submenuName.includes(keyword)
        );
      });
    }

    if (stockFilter !== 'all') {
      result = result.filter((item) => {
        const stock = Number(item.stock || 0);

        if (stockFilter === 'in') return stock > 5;
        if (stockFilter === 'low') return stock > 0 && stock <= 5;
        if (stockFilter === 'out') return stock <= 0;

        return true;
      });
    }

    if (categoryFilter !== 'all') {
      result = result.filter(
        (item) => String(item.category?._id || '') === String(categoryFilter)
      );
    }

    result.sort((a, b) => {
      const stockA = Number(a.stock || 0);
      const stockB = Number(b.stock || 0);
      const soldA = Number(a.sold || 0);
      const soldB = Number(b.sold || 0);
      const priceA = Number(a.price || 0);
      const priceB = Number(b.price || 0);

      switch (sortBy) {
        case 'stockDesc':
          return stockB - stockA;
        case 'soldDesc':
          return soldB - soldA;
        case 'soldAsc':
          return soldA - soldB;
        case 'priceDesc':
          return priceB - priceA;
        case 'priceAsc':
          return priceA - priceB;
        case 'nameAsc':
          return String(a.name || '').localeCompare(String(b.name || ''));
        case 'nameDesc':
          return String(b.name || '').localeCompare(String(a.name || ''));
        case 'stockAsc':
        default:
          return stockA - stockB;
      }
    });

    return result;
  }, [products, searchText, stockFilter, categoryFilter, sortBy]);

  const kpi = useMemo(() => {
    const totalProducts = products.length;
    const inStock = products.filter((p) => Number(p.stock || 0) > 5).length;
    const lowStock = products.filter(
      (p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 5
    ).length;
    const outStock = products.filter((p) => Number(p.stock || 0) <= 0).length;
    const totalSold = products.reduce((sum, p) => sum + Number(p.sold || 0), 0);

    return {
      totalProducts,
      inStock,
      lowStock,
      outStock,
      totalSold
    };
  }, [products]);

  return (
    <LayoutComponent>
      <div className="admin-page-header">
        <h1>Quản lý sản phẩm</h1>
        <p>Theo dõi sản phẩm, tồn kho, số lượng đã bán và phân loại sản phẩm.</p>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          className="admin-reset-filter-btn"
          onClick={() => {
            setShowEditForm(false);
            setShowAddForm((prev) => !prev);
          }}
        >
          {showAddForm ? 'Đóng form thêm sản phẩm' : '+ Thêm sản phẩm'}
        </button>

        {showEditForm && (
          <button
            className="admin-reset-filter-btn"
            onClick={() => {
              setShowEditForm(false);
              setEditProduct(DEFAULT_EDIT_PRODUCT);
            }}
          >
            Đóng form sửa sản phẩm
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleCreateProduct}
          style={{
            background: '#fff',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '18px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)'
          }}
        >
          <h3 style={{ marginBottom: '16px' }}>Thêm sản phẩm mới</h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '14px'
            }}
          >
            <input
              type="text"
              placeholder="Tên sản phẩm"
              value={newProduct.name}
              onChange={(e) => handleChangeNewProduct('name', e.target.value)}
            />

            <input
              type="text"
              placeholder="Giá, ví dụ: 2000000 hoặc 2.000.000"
              value={newProduct.price}
              onChange={(e) => handleChangeNewProduct('price', e.target.value)}
            />

            <input
              type="text"
              placeholder="Ảnh (vd: /images/ten-anh.png hoặc link https://...)"
              value={newProduct.image}
              onChange={(e) => handleChangeNewProduct('image', e.target.value)}
            />

            <input
              type="number"
              min="0"
              placeholder="Tồn kho ban đầu"
              value={newProduct.stock}
              onChange={(e) => handleChangeNewProduct('stock', e.target.value)}
            />

            <select
              value={newProduct.categoryId}
              onChange={(e) => {
                handleChangeNewProduct('categoryId', e.target.value);
                handleChangeNewProduct('submenuId', '');
              }}
            >
              <option value="">Chọn danh mục</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              value={newProduct.submenuId}
              onChange={(e) => handleChangeNewProduct('submenuId', e.target.value)}
              disabled={!selectedAddCategory}
            >
              <option value="">Chọn menu con</option>
              {addFormSubmenus.map((submenu) => (
                <option key={submenu._id} value={submenu._id}>
                  {submenu.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              max="100"
              placeholder="Discount %"
              value={newProduct.discountPercent}
              onChange={(e) => handleChangeNewProduct('discountPercent', e.target.value)}
            />

            <input
              type="text"
              placeholder="Discount price, ví dụ: 100000 hoặc 100.000"
              value={newProduct.discountPrice}
              onChange={(e) => handleChangeNewProduct('discountPrice', e.target.value)}
            />
          </div>

          <textarea
            placeholder="Mô tả sản phẩm"
            value={newProduct.description}
            onChange={(e) => handleChangeNewProduct('description', e.target.value)}
            rows="4"
            style={{
              width: '100%',
              marginTop: '14px',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #ccc'
            }}
          />

          {newProduct.image && (
            <div style={{ marginTop: '14px' }}>
              <p style={{ marginBottom: '8px' }}>Xem trước ảnh:</p>
              <img
                src={getImageSrc(newProduct.image)}
                alt="preview"
                width="120"
                height="120"
                style={{ objectFit: 'cover', borderRadius: '8px' }}
                onError={handleImageError}
              />
            </div>
          )}

          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={creating}>
              {creating ? 'Đang thêm...' : 'Lưu sản phẩm'}
            </button>

            <button
              type="button"
              onClick={() => {
                setNewProduct(DEFAULT_NEW_PRODUCT);
                setShowAddForm(false);
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {showEditForm && (
        <form
          onSubmit={handleUpdateProduct}
          style={{
            background: '#fff',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '18px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)'
          }}
        >
          <h3 style={{ marginBottom: '16px' }}>Sửa sản phẩm</h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '14px'
            }}
          >
            <input
              type="text"
              placeholder="Tên sản phẩm"
              value={editProduct.name}
              onChange={(e) => handleChangeEditProduct('name', e.target.value)}
            />

            <input
              type="text"
              placeholder="Giá, ví dụ: 2000000 hoặc 2.000.000"
              value={editProduct.price}
              onChange={(e) => handleChangeEditProduct('price', e.target.value)}
            />

            <input
              type="text"
              placeholder="Ảnh (vd: /images/ten-anh.png hoặc link https://...)"
              value={editProduct.image}
              onChange={(e) => handleChangeEditProduct('image', e.target.value)}
            />

            <input
              type="number"
              min="0"
              placeholder="Tồn kho"
              value={editProduct.stock}
              onChange={(e) => handleChangeEditProduct('stock', e.target.value)}
            />

            <select
              value={editProduct.categoryId}
              onChange={(e) => {
                handleChangeEditProduct('categoryId', e.target.value);
                handleChangeEditProduct('submenuId', '');
              }}
            >
              <option value="">Chọn danh mục</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              value={editProduct.submenuId}
              onChange={(e) => handleChangeEditProduct('submenuId', e.target.value)}
              disabled={!selectedEditCategory}
            >
              <option value="">Chọn menu con</option>
              {editFormSubmenus.map((submenu) => (
                <option key={submenu._id} value={submenu._id}>
                  {submenu.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              max="100"
              placeholder="Discount %"
              value={editProduct.discountPercent}
              onChange={(e) => handleChangeEditProduct('discountPercent', e.target.value)}
            />

            <input
              type="text"
              placeholder="Discount price, ví dụ: 100000 hoặc 100.000"
              value={editProduct.discountPrice}
              onChange={(e) => handleChangeEditProduct('discountPrice', e.target.value)}
            />
          </div>

          <textarea
            placeholder="Mô tả sản phẩm"
            value={editProduct.description}
            onChange={(e) => handleChangeEditProduct('description', e.target.value)}
            rows="4"
            style={{
              width: '100%',
              marginTop: '14px',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #ccc'
            }}
          />

          {editProduct.image && (
            <div style={{ marginTop: '14px' }}>
              <p style={{ marginBottom: '8px' }}>Xem trước ảnh:</p>
              <img
                src={getImageSrc(editProduct.image)}
                alt="preview"
                width="120"
                height="120"
                style={{ objectFit: 'cover', borderRadius: '8px' }}
                onError={handleImageError}
              />
            </div>
          )}

          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={updating}>
              {updating ? 'Đang cập nhật...' : 'Lưu cập nhật'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowEditForm(false);
                setEditProduct(DEFAULT_EDIT_PRODUCT);
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <p>Tổng sản phẩm</p>
          <h3>{kpi.totalProducts}</h3>
        </div>
        <div className="admin-kpi-card">
          <p>Còn hàng</p>
          <h3>{kpi.inStock}</h3>
        </div>
        <div className="admin-kpi-card">
          <p>Sắp hết</p>
          <h3>{kpi.lowStock}</h3>
        </div>
        <div className="admin-kpi-card">
          <p>Hết hàng</p>
          <h3>{kpi.outStock}</h3>
        </div>
        <div className="admin-kpi-card">
          <p>Tổng đã bán</p>
          <h3>{kpi.totalSold}</h3>
        </div>
      </div>

      <div className="admin-order-toolbar">
        <input
          type="text"
          placeholder="Tìm theo ID, tên sản phẩm, danh mục, menu con..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
          <option value="all">Tất cả trạng thái kho</option>
          <option value="in">Còn hàng</option>
          <option value="low">Sắp hết hàng</option>
          <option value="out">Hết hàng</option>
        </select>

        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">Tất cả danh mục</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="stockAsc">Tồn kho thấp nhất</option>
          <option value="stockDesc">Tồn kho cao nhất</option>
          <option value="soldDesc">Bán chạy nhất</option>
          <option value="soldAsc">Bán ít nhất</option>
          <option value="priceDesc">Giá cao nhất</option>
          <option value="priceAsc">Giá thấp nhất</option>
          <option value="nameAsc">Tên A - Z</option>
          <option value="nameDesc">Tên Z - A</option>
        </select>

        <button className="admin-reset-filter-btn" onClick={resetFilters}>
          Xóa bộ lọc
        </button>

        <button className="admin-reset-filter-btn" onClick={fetchAllData}>
          Tải lại danh sách
        </button>
      </div>

      {message && <p className="error-text">{message}</p>}

      {loading ? (
        <div className="admin-empty-box">
          <p>Đang tải dữ liệu...</p>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên sản phẩm</th>
              <th>Giá</th>
              <th>Hình ảnh</th>
              <th>Danh mục</th>
              <th>Menu con</th>
              <th>Thiết lập phân loại</th>
              <th>Tồn kho</th>
              <th>Đã bán</th>
              <th>Trạng thái kho</th>
              <th>Điều chỉnh kho</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length > 0 ? (
              filteredProducts.map((item) => {
                const selectedCategory = getSelectedCategory(item._id);
                const availableSubmenus = selectedCategory?.submenus || [];

                return (
                  <tr key={item._id}>
                    <td>{item._id}</td>
                    <td>{item.name}</td>
                    <td>{Number(item.price || 0).toLocaleString('vi-VN')} đ</td>
                    <td>
                      {item.image ? (
                        <img
                          src={getImageSrc(item.image)}
                          alt={item.name}
                          width="80"
                          height="80"
                          style={{ objectFit: 'cover', borderRadius: '8px' }}
                          onError={handleImageError}
                        />
                      ) : (
                        'Không có ảnh'
                      )}
                    </td>
                    <td>{item.category?.name || 'Chưa có'}</td>
                    <td>{item.submenu?.name || 'Chưa có'}</td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          minWidth: '220px'
                        }}
                      >
                        <select
                          value={classificationEdits[item._id]?.categoryId || ''}
                          onChange={(e) => handleChangeCategory(item._id, e.target.value)}
                        >
                          <option value="">Chọn danh mục</option>
                          {categories.map((cat) => (
                            <option key={cat._id} value={cat._id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={classificationEdits[item._id]?.submenuId || ''}
                          onChange={(e) => handleChangeSubmenu(item._id, e.target.value)}
                          disabled={!selectedCategory}
                        >
                          <option value="">Chọn menu con</option>
                          {availableSubmenus.map((submenu) => (
                            <option key={submenu._id} value={submenu._id}>
                              {submenu.name}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleSaveClassification(item)}
                          disabled={savingId === item._id}
                        >
                          {savingId === item._id ? 'Đang lưu...' : 'Lưu phân loại'}
                        </button>
                      </div>
                    </td>

                    <td>{Number(item.stock || 0)}</td>
                    <td>{Number(item.sold || 0)}</td>
                    <td>
                      <span className={getStockClass(item.stock)}>
                        {getStockStatus(item.stock)}
                      </span>
                    </td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          minWidth: '220px'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            value={adjustments[item._id]?.quantity ?? 1}
                            onChange={(e) => handleChangeQuantity(item._id, e.target.value)}
                            style={{ width: '70px', padding: '8px' }}
                          />
                          <button
                            onClick={() => handleAdjustStock(item, 'increase')}
                            disabled={savingId === item._id}
                          >
                            + Nhập
                          </button>
                          <button
                            onClick={() => handleAdjustStock(item, 'decrease')}
                            disabled={savingId === item._id}
                          >
                            - Trừ
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            value={adjustments[item._id]?.stock ?? Number(item.stock || 0)}
                            onChange={(e) => handleChangeStock(item._id, e.target.value)}
                            style={{ width: '90px', padding: '8px' }}
                          />
                          <button
                            onClick={() => handleSetStock(item)}
                            disabled={savingId === item._id}
                          >
                            Đặt lại tồn
                          </button>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={() => openEditForm(item)}>Sửa</button>

                        <button
                          onClick={() => handleDeleteProduct(item)}
                          disabled={deletingId === item._id}
                          style={{
                            background: '#e53935',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          {deletingId === item._id ? 'Đang xóa...' : 'Xóa'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="12">Không có sản phẩm phù hợp</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </LayoutComponent>
  );
}

export default ProductAdminComponent;