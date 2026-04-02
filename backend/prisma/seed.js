const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Georgian category names
const categoryNames = {
  'graphics cards': 'ვიდეო ბარათები',
  'cases': 'კორპუსები',
  'cooling': 'გაგრილება',
  'motherboards': 'დედაპლატები',
  'memory': 'მეხსიერება',
  'monitors': 'მონიტორები',
  'ups': 'UPS',
  'processors': 'პროცესორები',
  'networking': 'ქსელი',
  'thermal': 'თერმოპასტა',
  'accessories': 'აქსესუარები',
  'keyboards': 'კლავიატურები',
  'mice': 'მაუსები',
  'mousepads': 'მაუსპადები',
  'audio': 'აუდიო',
  'notebooks': 'ნოუთბუქები'
};

async function main() {
  console.log('Seeding database...');

  // Read products.json from the frontend
  const jsonPath = path.join(__dirname, '..', '..', 'js', 'products.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // 1. Create categories
  const uniqueCategories = [...new Set(data.products.map(p => p.category))];
  console.log(`Creating ${uniqueCategories.length} categories...`);

  const categoryMap = {};
  for (const catName of uniqueCategories) {
    const slug = catName.toLowerCase().replace(/\s+/g, '-');
    const category = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        nameEn: catName.charAt(0).toUpperCase() + catName.slice(1),
        nameGe: categoryNames[catName] || null
      }
    });
    categoryMap[catName] = category.id;
  }
  console.log('Categories created.');

  // 2. Create products
  console.log(`Creating ${data.products.length} products...`);

  for (const p of data.products) {
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const stockQty = p.availability === 'instock' ? 10 : 0;

    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        price: p.price,
        description: p.description || null,
        brand: p.brand || null,
        imageUrl: p.image || null,
        availability: p.availability === 'instock' ? 'instock' : 'preorder',
        useCase: p.use || null,
        rating: p.rating || 0,
        stockQuantity: stockQty,
        isFeatured: p.id < 8, // first 8 products as featured
        categoryId: categoryMap[p.category]
      },
      create: {
        id: p.id,
        name: p.name,
        slug,
        price: p.price,
        description: p.description || null,
        categoryId: categoryMap[p.category],
        brand: p.brand || null,
        imageUrl: p.image || null,
        availability: p.availability === 'instock' ? 'instock' : 'preorder',
        useCase: p.use || null,
        rating: p.rating || 0,
        stockQuantity: stockQty,
        isFeatured: p.id < 8,
        isActive: true
      }
    });
  }
  console.log('Products created.');

  // 3. Reset auto-increment sequence to max id + 1
  const maxId = Math.max(...data.products.map(p => p.id));
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE products_id_seq RESTART WITH ${maxId + 1}`);

  // 4. Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@gitec.ge' },
    update: {},
    create: {
      email: 'admin@gitec.ge',
      passwordHash: adminPassword,
      fullName: 'GITEC Admin',
      role: 'admin'
    }
  });
  console.log('Admin user created (admin@gitec.ge / admin123)');

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
