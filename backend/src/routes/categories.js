const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /categories
router.get('/', (req, res) => {
  const categories = db.all('categories').map(c => {
    const count = db.count('products', p => p.categoryId === c.id && p.isActive);
    return { ...c, productCount: count };
  });
  categories.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  res.json({ categories });
});

// GET /categories/:slug
router.get('/:slug', (req, res) => {
  const category = db.findOne('categories', c => c.slug === req.params.slug);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const products = db.find('products', p => p.categoryId === category.id && p.isActive);
  res.json({ category, products });
});

module.exports = router;
