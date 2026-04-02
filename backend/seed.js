/**
 * Seed JSON data files from the frontend products.json.
 * Run: node seed.js
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function write(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name + '.json'), JSON.stringify(data, null, 2));
  console.log(`  ${name}.json — ${data.length} records`);
}

async function main() {
  console.log('Seeding JSON data files...\n');

  // Read source
  const src = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'js', 'products.json'), 'utf-8'));

  // Georgian category names
  const geNames = {
    'graphics cards': 'ვიდეო ბარათები', 'cases': 'კორპუსები', 'cooling': 'გაგრილება',
    'motherboards': 'დედაპლატები', 'memory': 'მეხსიერება', 'monitors': 'მონიტორები',
    'ups': 'UPS', 'processors': 'პროცესორები', 'networking': 'ქსელი',
    'thermal': 'თერმოპასტა', 'accessories': 'აქსესუარები', 'keyboards': 'კლავიატურები',
    'mice': 'მაუსები', 'mousepads': 'მაუსპადები', 'audio': 'აუდიო', 'notebooks': 'ნოუთბუქები'
  };

  // 1. Categories
  const uniqueCats = [...new Set(src.products.map(p => p.category))];
  const categories = uniqueCats.map((cat, i) => ({
    id: i + 1,
    slug: cat.toLowerCase().replace(/\s+/g, '-'),
    nameEn: cat.charAt(0).toUpperCase() + cat.slice(1),
    nameGe: geNames[cat] || null
  }));
  write('categories', categories);

  const catMap = {};
  categories.forEach(c => { catMap[c.slug] = c.id; });

  // 2. Products
  const products = src.products.map(p => ({
    id: p.id,
    name: p.name,
    slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    description: p.description || '',
    price: p.price,
    salePrice: null,
    categoryId: catMap[p.category.toLowerCase().replace(/\s+/g, '-')] || 1,
    category: p.category,
    brand: p.brand || '',
    imageUrl: p.image || '',
    availability: p.availability === 'instock' ? 'instock' : 'preorder',
    useCase: p.use || '',
    rating: p.rating || 0,
    stockQuantity: p.availability === 'instock' ? 10 : 0,
    isFeatured: p.id < 8,
    isActive: true,
    sale: p.sale || false,
    createdAt: new Date().toISOString()
  }));
  write('products', products);

  // 3. Store & banking info (keep for chatbot/about pages)
  fs.writeFileSync(path.join(DATA_DIR, 'store.json'), JSON.stringify(src.store, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'banking.json'), JSON.stringify(src.banking, null, 2));
  console.log('  store.json, banking.json — copied');

  // 4. Admin user
  const hash = await bcrypt.hash('admin123', 12);
  const users = [{
    id: 1,
    email: 'admin@gitec.ge',
    passwordHash: hash,
    fullName: 'GITEC Admin',
    phone: '032 291 34 56',
    role: 'admin',
    createdAt: new Date().toISOString()
  }];
  write('users', users);

  // 5. Empty tables
  write('cart_items', []);
  write('wishlist_items', []);
  write('orders', []);
  write('order_items', []);
  write('contact_messages', []);
  write('newsletter_subscribers', []);
  write('password_resets', []);

  console.log('\nSeed complete! Admin: admin@gitec.ge / admin123');
}

main().catch(e => { console.error(e); process.exit(1); });
