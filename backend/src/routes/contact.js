const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { sendContactNotification } = require('../services/email');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
};

// POST /contact
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters'),
  validate
], (req, res) => {
  const { name, email, message } = req.body;

  const contact = db.insert('contact_messages', {
    name, email, message,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  sendContactNotification({ name, email, message }).catch(err => {
    console.error('Contact email error:', err.message);
  });

  res.status(201).json({ message: 'Message sent successfully', id: contact.id });
});

module.exports = router;
