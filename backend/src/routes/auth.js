const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

// POST /auth/register
router.post('/register', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  validate
], async (req, res, next) => {
  try {
    const { email, password, fullName, phone, dateOfBirth } = req.body;

    const existing = db.findOne('users', u => u.email === email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = db.insert('users', {
      email, passwordHash, fullName,
      phone: phone || null,
      dateOfBirth: dateOfBirth || null,
      role: 'customer',
      createdAt: new Date().toISOString()
    });

    req.session.userId = user.id;
    req.session.role = user.role;

    res.status(201).json({
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = db.findOne('users', u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user.id;
    req.session.role = user.role;

    res.json({
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Failed to logout' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// GET /auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.findById('users', req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    user: { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, dateOfBirth: user.dateOfBirth, role: user.role, createdAt: user.createdAt }
  });
});

// POST /auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email is required'),
  validate
], (req, res) => {
  const { email } = req.body;
  const user = db.findOne('users', u => u.email === email);

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    db.insert('password_resets', {
      userId: user.id, token,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      used: false
    });
    console.log(`Password reset token for ${email}: ${token}`);
  }

  res.json({ message: 'If that email exists, a reset link has been sent' });
});

// POST /auth/reset-password
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate
], async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const reset = db.findOne('password_resets', r => r.token === token);
    if (!reset || reset.used || new Date(reset.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    db.update('users', reset.userId, { passwordHash });
    db.update('password_resets', reset.id, { used: true });

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
