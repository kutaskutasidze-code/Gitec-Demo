const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /wishlist
router.get('/', (req, res) => {
  const items = db.find('wishlist_items', i => i.userId === req.session.userId);
  const enriched = items.map(item => {
    const product = db.findById('products', item.productId);
    return { ...item, product: product || null };
  }).filter(i => i.product);

  res.json({ items: enriched, count: enriched.length });
});

// POST /wishlist
router.post('/', (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId is required' });

  const product = db.findById('products', productId);
  if (!product || !product.isActive) return res.status(404).json({ error: 'Product not found' });

  const existing = db.findOne('wishlist_items', i => i.userId === req.session.userId && i.productId === productId);
  if (existing) return res.status(409).json({ error: 'Already in wishlist' });

  const item = db.insert('wishlist_items', {
    userId: req.session.userId, productId,
    createdAt: new Date().toISOString()
  });

  res.status(201).json({ item: { ...item, product } });
});

// DELETE /wishlist/:productId
router.delete('/:productId', (req, res) => {
  const productId = parseInt(req.params.productId);
  db.removeWhere('wishlist_items', i => i.userId === req.session.userId && i.productId === productId);
  res.json({ message: 'Removed from wishlist' });
});

module.exports = router;
