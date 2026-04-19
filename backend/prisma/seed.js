import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Platform
  const platform = await prisma.platform.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Fine Dine SaaS',
      super_admin_email: 'superadmin@finedine.com',
      super_admin_password: await bcrypt.hash('superadmin123', 10),
    },
  });

  console.log('✅ Platform created');

  // Create Brand
  const brand = await prisma.brand.upsert({
    where: { slug: 'bella-vista' },
    update: {},
    create: {
      name: 'Bella Vista Restaurant',
      slug: 'bella-vista',
      logo_url: 'https://example.com/logo.png',
      primary_color: '#FF6B35',
      secondary_color: '#F7931E',
    },
  });

  console.log('✅ Brand created');

  // Create Location
  const location = await prisma.location.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Downtown Branch',
      address: '123 Main Street, Downtown City',
      active: true,
      brand_id: brand.id,
    },
  });

  console.log('✅ Location created');

  // Create Menu
  const menu = await prisma.menu.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Main Menu',
      active: true,
      brand_id: brand.id,
      location_id: location.id,
    },
  });

  console.log('✅ Menu created');

  // Create Categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { id: 1 },
      update: {},
      create: {
        menu_id: menu.id,
        name: { en: 'Appetizers' },
        sort_order: 1,
        active: true,
      },
    }),
    prisma.category.upsert({
      where: { id: 2 },
      update: {},
      create: {
        menu_id: menu.id,
        name: { en: 'Main Courses' },
        sort_order: 2,
        active: true,
      },
    }),
    prisma.category.upsert({
      where: { id: 3 },
      update: {},
      create: {
        menu_id: menu.id,
        name: { en: 'Desserts' },
        sort_order: 3,
        active: true,
      },
    }),
    prisma.category.upsert({
      where: { id: 4 },
      update: {},
      create: {
        menu_id: menu.id,
        name: { en: 'Beverages' },
        sort_order: 4,
        active: true,
      },
    }),
  ]);

  console.log('✅ Categories created');

  // Create Items
  const items = await Promise.all([
    // Appetizers
    prisma.item.upsert({
      where: { id: 1 },
      update: {},
      create: {
        category_id: categories[0].id,
        name: { en: 'Caesar Salad' },
        description: { en: 'Fresh romaine lettuce with Caesar dressing, croutons, and parmesan' },
        price: 12.99,
        available: true,
      },
    }),
    prisma.item.upsert({
      where: { id: 2 },
      update: {},
      create: {
        category_id: categories[0].id,
        name: { en: 'Garlic Bread' },
        description: { en: 'Toasted bread with garlic butter and herbs' },
        price: 8.99,
        available: true,
      },
    }),
    // Main Courses
    prisma.item.upsert({
      where: { id: 3 },
      update: {},
      create: {
        category_id: categories[1].id,
        name: { en: 'Grilled Salmon' },
        description: { en: 'Fresh Atlantic salmon with lemon herb sauce, served with rice and vegetables' },
        price: 24.99,
        available: true,
      },
    }),
    prisma.item.upsert({
      where: { id: 4 },
      update: {},
      create: {
        category_id: categories[1].id,
        name: { en: 'Ribeye Steak' },
        description: { en: '12oz prime ribeye steak with garlic mashed potatoes and asparagus' },
        price: 32.99,
        available: true,
      },
    }),
    // Desserts
    prisma.item.upsert({
      where: { id: 5 },
      update: {},
      create: {
        category_id: categories[2].id,
        name: { en: 'Chocolate Lava Cake' },
        description: { en: 'Warm chocolate cake with molten center, served with vanilla ice cream' },
        price: 9.99,
        available: true,
      },
    }),
    // Beverages
    prisma.item.upsert({
      where: { id: 6 },
      update: {},
      create: {
        category_id: categories[3].id,
        name: { en: 'House Wine' },
        description: { en: 'Red or white wine selection' },
        price: 8.99,
        available: true,
      },
    }),
  ]);

  console.log('✅ Items created');

  // Add choices, addons, and sizes to some items
  await Promise.all([
    // Caesar Salad choices
    prisma.itemChoice.upsert({
      where: { id: 1 },
      update: {},
      create: {
        item_id: items[0].id,
        label: { en: 'Dressing' },
        options: [
          { name: { en: 'Caesar' }, price: 0 },
          { name: { en: 'Ranch' }, price: 0 },
          { name: { en: 'Balsamic' }, price: 0 },
        ],
      },
    }),
    // Grilled Salmon addons
    prisma.itemAddon.upsert({
      where: { id: 1 },
      update: {},
      create: {
        item_id: items[2].id,
        label: { en: 'Extra Sauce' },
        extra_price: 2.99,
      },
    }),
    // Ribeye Steak sizes
    prisma.itemSize.upsert({
      where: { id: 1 },
      update: {},
      create: {
        item_id: items[3].id,
        label: { en: 'Size' },
        price: 0,
      },
    }),
    prisma.itemSize.upsert({
      where: { id: 2 },
      update: {},
      create: {
        item_id: items[3].id,
        label: { en: 'Large (16oz)' },
        price: 8.00,
      },
    }),
  ]);

  console.log('✅ Item options created');

  // Create Tables
  const tables = await Promise.all([
    prisma.table.upsert({
      where: { id: 1 },
      update: {},
      create: {
        location_id: location.id,
        number: '1',
        qr_text: 'fine-dine://table/1/1/1234567890',
        qr_image_url: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=fine-dine://table/1/1/1234567890',
        active: true,
      },
    }),
    prisma.table.upsert({
      where: { id: 2 },
      update: {},
      create: {
        location_id: location.id,
        number: '2',
        qr_text: 'fine-dine://table/1/2/1234567891',
        qr_image_url: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=fine-dine://table/1/2/1234567891',
        active: true,
      },
    }),
  ]);

  console.log('✅ Tables created');

  // Create Admin
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@finedine.com' },
    update: {},
    create: {
      name: 'Restaurant Admin',
      email: 'admin@finedine.com',
      password: await bcrypt.hash('admin123', 10),
      brand_id: brand.id,
    },
  });

  console.log('✅ Admin created');

  // Create Captain
  const captain = await prisma.captain.upsert({
    where: { email: 'captain@finedine.com' },
    update: {},
    create: {
      name: 'Server Captain',
      email: 'captain@finedine.com',
      password: await bcrypt.hash('captain123', 10),
      location_id: location.id,
      brand_id: brand.id,
      active: true,
    },
  });

  console.log('✅ Captain created');

  console.log('🎉 Database seeded successfully!');
  console.log('\n📋 Test Credentials:');
  console.log('Super Admin: superadmin@finedine.com / superadmin123');
  console.log('Admin: admin@finedine.com / admin123');
  console.log('Captain: captain@finedine.com / captain123');
  console.log('\n🏪 Test Brand: bella-vista');
  console.log('📍 Test Location: Downtown Branch (ID: 1)');
  console.log('🍽️  Test Menu: Main Menu');
  console.log('🪑 Test Tables: Table 1 & 2');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });