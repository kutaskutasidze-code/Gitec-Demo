const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
};

// POST /newsletter/subscribe
router.post('/subscribe', [
  body('email').isEmail().withMessage('Valid email is required'),
  validate
], (req, res) => {
  const { email } = req.body;

  const existing = db.findOne('newsletter_subscribers', s => s.email === email);
  if (existing) {
    if (!existing.isActive) {
      db.update('newsletter_subscribers', existing.id, { isActive: true });
      return res.json({ message: 'Re-subscribed successfully' });
    }
    return res.json({ message: 'Already subscribed' });
  }

  db.insert('newsletter_subscribers', {
    email, isActive: true,
    subscribedAt: new Date().toISOString()
  });
  res.status(201).json({ message: 'Subscribed successfully' });
});

// POST /newsletter/unsubscribe
router.post('/unsubscribe', [
  body('email').isEmail().withMessage('Valid email is required'),
  validate
], (req, res) => {
  db.updateWhere('newsletter_subscribers', s => s.email === req.body.email, { isActive: false });
  res.json({ message: 'Unsubscribed successfully' });
});

module.exports = router;
