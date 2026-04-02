const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
};

// ============ DASHBOARD ============
router.get('/dashboard', (req, res) => {
  const orders = db.all('orders');
  const paidStatuses = ['paid', 'processing', 'shipped', 'delivered'];
  const revenue = orders.filter(o => paidStatuses.includes(o.status)).reduce((s, o) => s + o.total, 0);

  const recentOrders = orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10).map(o => {
    const user = db.findById('users', o.userId);
    o.user = user ? { fullName: user.fullName, email: user.email } : null;
    o.items = db.find('order_items', i => i.orderId === o.id);
    return o;
  });

  res.json({
    stats: {
      totalProducts: db.count('products'),
      totalUsers: db.count('users', u => u.role === 'customer'),
      totalOrders: orders.length,
      revenue,
      totalSubscribers: db.count('newsletter_subscribers', s => s.isActive),
      unreadMessages: db.count('contact_messages', m => !m.isRead)
    },
    recentOrders
  });
});

// ============ PRODUCTS ============
router.get('/products', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const all = db.all('products');
  const paged = all.slice((page - 1) * limit, page * limit);
  res.json({ products: paged, total: all.length, page, totalPages: Math.ceil(all.length / limit) });
});

router.post('/products', [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
  body('categoryId').isInt().withMessage('Category ID is required'),
  validate
], (req, res) => {
  const { name, description, price, salePrice, categoryId, brand, imageUrl, availability, useCase, rating, stockQuantity, isFeatured } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cat = db.findById('categories', parseInt(categoryId));

  const product = db.insert('products', {
    name, slug, description: description || '',
    price: parseFloat(price), salePrice: salePrice ? parseFloat(salePrice) : null,
    categoryId: parseInt(categoryId), category: cat ? cat.nameEn.toLowerCase() : '',
    brand: brand || '', imageUrl: imageUrl || '',
    availability: availability || 'instock', useCase: useCase || '',
    rating: rating ? parseFloat(rating) : 0,
    stockQuantity: stockQuantity ? parseInt(stockQuantity) : 0,
    isFeatured: !!isFeatured, isActive: true, sale: false,
    createdAt: new Date().toISOString()
  });

  res.status(201).json({ product });
});

router.patch('/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.findById('products', id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const updates = {};
  const fields = ['name', 'description', 'brand', 'imageUrl', 'availability', 'useCase', 'isFeatured', 'isActive'];
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (req.body.price !== undefined) updates.price = parseFloat(req.body.price);
  if (req.body.salePrice !== undefined) updates.salePrice = req.body.salePrice ? parseFloat(req.body.salePrice) : null;
  if (req.body.categoryId !== undefined) updates.categoryId = parseInt(req.body.categoryId);
  if (req.body.stockQuantity !== undefined) updates.stockQuantity = parseInt(req.body.stockQuantity);
  if (req.body.rating !== undefined) updates.rating = parseFloat(req.body.rating);
  if (req.body.name) updates.slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const product = db.update('products', id, updates);
  res.json({ product });
});

router.delete('/products/:id', (req, res) => {
  db.update('products', parseInt(req.params.id), { isActive: false });
  res.json({ message: 'Product deactivated' });
});

// ============ ORDERS ============
router.get('/orders', (req, res) => {
  const { status, page: p } = req.query;
  let orders = db.all('orders');
  if (status) orders = orders.filter(o => o.status === status);
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const page = parseInt(p) || 1;
  const limit = 20;
  const paged = orders.slice((page - 1) * limit, page * limit).map(o => {
    const user = db.findById('users', o.userId);
    o.user = user ? { fullName: user.fullName, email: user.email } : null;
    o.items = db.find('order_items', i => i.orderId === o.id);
    return o;
  });

  res.json({ orders: paged, total: orders.length, page, totalPages: Math.ceil(orders.length / limit) });
});

router.patch('/orders/:id', (req, res) => {
  const order = db.update('orders', parseInt(req.params.id), { status: req.body.status });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.items = db.find('order_items', i => i.orderId === order.id);
  res.json({ order });
});

// ============ USERS ============
router.get('/users', (req, res) => {
  const users = db.all('users').map(u => {
    const orderCount = db.count('orders', o => o.userId === u.id);
    return { id: u.id, email: u.email, fullName: u.fullName, phone: u.phone, role: u.role, createdAt: u.createdAt, orderCount };
  });
  res.json({ users });
});

// ============ MESSAGES ============
router.get('/messages', (req, res) => {
  const messages = db.all('contact_messages').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ messages });
});

router.patch('/messages/:id', (req, res) => {
  const message = db.update('contact_messages', parseInt(req.params.id), { isRead: true });
  res.json({ message });
});

// ============ SUBSCRIBERS ============
router.get('/subscribers', (req, res) => {
  const subscribers = db.all('newsletter_subscribers').sort((a, b) => new Date(b.subscribedAt) - new Date(a.subscribedAt));
  res.json({ subscribers });
});

module.exports = router;
