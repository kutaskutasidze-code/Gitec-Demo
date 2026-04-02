const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendOrderConfirmation } = require('../services/email');

const router = express.Router();
router.use(requireAuth);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
};

// POST /orders — create order from cart
router.post('/', [
  body('shippingName').trim().notEmpty().withMessage('Shipping name is required'),
  body('shippingAddress').trim().notEmpty().withMessage('Shipping address is required'),
  body('shippingCity').trim().notEmpty().withMessage('Shipping city is required'),
  body('shippingPhone').trim().notEmpty().withMessage('Shipping phone is required'),
  body('paymentMethod').isIn(['bog_ipay', 'tbc_pay', 'cash_on_delivery']).withMessage('Invalid payment method'),
  validate
], (req, res) => {
  const { shippingName, shippingAddress, shippingCity, shippingPhone, paymentMethod, notes } = req.body;
  const userId = req.session.userId;

  const cartItems = db.find('cart_items', i => i.userId === userId);
  if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

  // Build order items and calculate total
  let subtotal = 0;
  const orderItemsData = [];

  for (const ci of cartItems) {
    const product = db.findById('products', ci.productId);
    if (!product) continue;
    const price = product.salePrice || product.price;
    const itemSub = price * ci.quantity;
    subtotal += itemSub;
    orderItemsData.push({
      productId: product.id,
      productName: product.name,
      productPrice: price,
      quantity: ci.quantity,
      subtotal: itemSub
    });
  }

  const isTbilisi = shippingCity.toLowerCase() === 'tbilisi' || shippingCity === 'თბილისი';
  const shippingCost = subtotal >= 499 ? 0 : (isTbilisi ? 6 : 8);
  const total = subtotal + shippingCost;

  // Create order
  const order = db.insert('orders', {
    userId, status: 'pending', total, shippingCost,
    shippingName, shippingAddress, shippingCity, shippingPhone,
    paymentMethod, notes: notes || '',
    createdAt: new Date().toISOString()
  });

  // Create order items
  const items = orderItemsData.map(oi => db.insert('order_items', { orderId: order.id, ...oi }));

  // Decrement stock
  for (const ci of cartItems) {
    const product = db.findById('products', ci.productId);
    if (product) {
      db.update('products', product.id, { stockQuantity: Math.max(0, product.stockQuantity - ci.quantity) });
    }
  }

  // Clear cart
  db.removeWhere('cart_items', i => i.userId === userId);

  // Send email (non-blocking)
  const user = db.findById('users', userId);
  if (user) {
    sendOrderConfirmation({ order, items, userEmail: user.email }).catch(err => {
      console.error('Email error:', err.message);
    });
  }

  order.items = items;
  res.status(201).json({ order });
});

// GET /orders
router.get('/', (req, res) => {
  const orders = db.find('orders', o => o.userId === req.session.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Attach items to each order
  orders.forEach(o => {
    o.items = db.find('order_items', i => i.orderId === o.id);
  });

  res.json({ orders });
});

// GET /orders/:id
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const order = db.findOne('orders', o => o.id === id && o.userId === req.session.userId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.items = db.find('order_items', i => i.orderId === order.id);
  res.json({ order });
});

module.exports = router;
