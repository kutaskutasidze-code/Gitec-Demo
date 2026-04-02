const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /products/featured
router.get('/featured', (req, res) => {
  const products = db.find('products', p => p.isFeatured && p.isActive).slice(0, 8);
  res.json({ products });
});

// GET /products
router.get('/', (req, res) => {
  const { category, brand, minPrice, maxPrice, rating, availability, use, sale, search, sort, page, limit } = req.query;

  let products = db.find('products', p => p.isActive);

  // Filters
  if (category) {
    const cat = db.findOne('categories', c => c.slug === category);
    if (cat) products = products.filter(p => p.categoryId === cat.id);
  }
  if (brand) {
    const brands = brand.split(',').map(b => b.trim().toLowerCase());
    products = products.filter(p => brands.includes((p.brand || '').toLowerCase()));
  }
  if (minPrice) products = products.filter(p => p.price >= parseFloat(minPrice));
  if (maxPrice) products = products.filter(p => p.price <= parseFloat(maxPrice));
  if (rating) products = products.filter(p => p.rating >= parseFloat(rating));
  if (availability) products = products.filter(p => p.availability === availability);
  if (use) products = products.filter(p => p.useCase === use);
  if (sale === 'true') products = products.filter(p => p.salePrice != null);
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q)
    );
  }

  // Sort
  if (sort === 'price_asc') products.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
  else if (sort === 'name') products.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'newest') products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);

  // Pagination
  const total = products.length;
  const pageNum = parseInt(page) || 1;
  const perPage = Math.min(parseInt(limit) || 16, 100);
  const start = (pageNum - 1) * perPage;
  const paged = products.slice(start, start + perPage);

  res.json({
    products: paged,
    pagination: { page: pageNum, perPage, total, totalPages: Math.ceil(total / perPage) }
  });
});

// GET /products/:id
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid product ID' });

  const product = db.findById('products', id);
  if (!product || !product.isActive) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Attach category info
  const cat = db.findById('categories', product.categoryId);
  product.categoryInfo = cat || null;

  res.json({ product });
});

module.exports = router;
