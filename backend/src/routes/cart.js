const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /cart
router.get('/', (req, res) => {
  const items = db.find('cart_items', i => i.userId === req.session.userId);

  const enriched = items.map(item => {
    const product = db.findById('products', item.productId);
    return { ...item, product: product || null };
  }).filter(i => i.product);

  const total = enriched.reduce((sum, i) => {
    const price = i.product.salePrice || i.product.price;
    return sum + price * i.quantity;
  }, 0);

  res.json({
    items: enriched,
    total,
    count: enriched.reduce((s, i) => s + i.quantity, 0)
  });
});

// POST /cart — add or increment
router.post('/', (req, res) => {
  const { productId, quantity } = req.body;
  if (productId === undefined || productId === null) return res.status(400).json({ error: 'productId is required' });

  const pid = parseInt(productId);
  const product = db.findById('products', pid);
  if (!product || !product.isActive) return res.status(404).json({ error: 'Product not found' });

  const existing = db.findOne('cart_items', i => i.userId === req.session.userId && i.productId === pid);
  if (existing) {
    db.update('cart_items', existing.id, { quantity: existing.quantity + (quantity || 1) });
    res.json({ item: { ...existing, quantity: existing.quantity + (quantity || 1) } });
  } else {
    const item = db.insert('cart_items', {
      userId: req.session.userId,
      productId: pid,
      quantity: quantity || 1,
      createdAt: new Date().toISOString()
    });
    res.json({ item });
  }
});

// POST /cart/merge — merge guest cart on login
router.post('/merge', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

  for (const { productId, quantity } of items) {
    if (!productId || !quantity) continue;
    const existing = db.findOne('cart_items', i => i.userId === req.session.userId && i.productId === productId);
    if (existing) {
      db.update('cart_items', existing.id, { quantity: existing.quantity + quantity });
    } else {
      db.insert('cart_items', {
        userId: req.session.userId, productId, quantity,
        createdAt: new Date().toISOString()
      });
    }
  }
  res.json({ message: 'Cart merged' });
});

// PATCH /cart/:productId
router.patch('/:productId', (req, res) => {
  const productId = parseInt(req.params.productId);
  const { quantity } = req.body;
  if (!quantity || quantity < 1) return res.status(400).json({ error: 'Quantity must be at least 1' });

  const item = db.updateWhere('cart_items',
    i => i.userId === req.session.userId && i.productId === productId,
    { quantity }
  );
  if (!item) return res.status(404).json({ error: 'Item not found in cart' });
  res.json({ item });
});

// DELETE /cart/:productId
router.delete('/:productId', (req, res) => {
  const productId = parseInt(req.params.productId);
  db.removeWhere('cart_items', i => i.userId === req.session.userId && i.productId === productId);
  res.json({ message: 'Item removed' });
});

// DELETE /cart
router.delete('/', (req, res) => {
  db.removeWhere('cart_items', i => i.userId === req.session.userId);
  res.json({ message: 'Cart cleared' });
});

module.exports = router;
