const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const orderRoutes = require('./routes/orders');
const contactRoutes = require('./routes/contact');
const newsletterRoutes = require('./routes/newsletter');
const adminRoutes = require('./routes/admin');

const app = express();

// ============ MIDDLEWARE ============

// CORS — still needed if frontend is served separately in production
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session — in-memory store (fine for dev, swap to PG/Redis in production)
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));

// ============ API ROUTES ============

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/newsletter', newsletterRoutes);
app.use('/api/v1/admin', adminRoutes);

// ============ SERVE FRONTEND ============
// Serve the frontend static files from the parent directory (same origin = cookies work)
const frontendDir = path.join(__dirname, '..', '..');
app.use(express.static(frontendDir));

// Fallback: serve index.html for any non-API route (SPA-like)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  // Try to serve the requested file, fall back to 404
  res.sendFile(path.join(frontendDir, req.path), (err) => {
    if (err) res.status(404).sendFile(path.join(frontendDir, 'index.html'));
  });
});

// Error handler
app.use(errorHandler);

// ============ START ============

app.listen(config.port, () => {
  console.log(`GITEC running on http://localhost:${config.port}`);
  console.log('API: /api/v1/*');
  console.log('Frontend: / (served from parent directory)');
  console.log('Data stored in: backend/data/*.json');
});
