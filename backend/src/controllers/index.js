import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import xlsx from 'xlsx';
import QRCode from 'qrcode';
import prisma from '../lib/prisma.js';
import { emitLocation, emitOrder } from '../socket/socket.handler.js';

const JWT_SECRET = process.env.JWT_SECRET;

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

function parseUploadedSheet(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet, { defval: null });
}

function computeOrderTotal(orderItems) {
  return orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
}

function buildPagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200);
  return { skip: (page - 1) * limit, take: limit };
}

function validateLocationAccess(user, locationId) {
  return user?.role !== 'captain' || user.locationId === locationId;
}

export async function adminLogin(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken({ role: 'admin', id: admin.id, brandId: admin.brand_id, email: admin.email });
  res.json({ token, user: { id: admin.id, email: admin.email, name: admin.name, brandId: admin.brand_id } });
}

export async function captainLogin(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const captain = await prisma.captain.findUnique({ where: { email } });
  if (!captain || !(await bcrypt.compare(password, captain.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (!captain.active) return res.status(403).json({ error: 'Captain is inactive' });

  const token = signToken({ role: 'captain', id: captain.id, brandId: captain.brand_id, locationId: captain.location_id, email: captain.email });
  res.json({ token, user: { id: captain.id, email: captain.email, name: captain.name, locationId: captain.location_id, brandId: captain.brand_id } });
}

export async function superAdminLogin(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const platform = await prisma.platform.findUnique({ where: { super_admin_email: email } });
  if (!platform || !(await bcrypt.compare(password, platform.super_admin_password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken({ role: 'superadmin', id: platform.id, email: platform.super_admin_email });
  res.json({ token, user: { id: platform.id, email: platform.super_admin_email, name: platform.name } });
}

export async function getBrand(req, res) {
  const brand = await prisma.brand.findUnique({ where: { id: req.user.brandId } });
  if (!brand) return res.status(404).json({ error: 'Brand not found' });
  res.json(brand);
}

export async function updateBrand(req, res) {
  const body = req.body;
  const brand = await prisma.brand.update({
    where: { id: req.user.brandId },
    data: {
      name: body.name,
      logo_url: body.logo_url,
      primary_color: body.primary_color,
      secondary_color: body.secondary_color,
      font_style: body.font_style,
      banner_url: body.banner_url,
      status: body.status,
    },
  });
  res.json(brand);
}

export async function listLocations(req, res) {
  const locations = await prisma.location.findMany({ where: { brand_id: req.user.brandId } });
  res.json(locations);
}

export async function createLocation(req, res) {
  const { name, address, active = true } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'Name and address are required' });
  const location = await prisma.location.create({
    data: { name, address, active, brand_id: req.user.brandId },
  });
  res.status(201).json(location);
}

export async function updateLocation(req, res) {
  const id = Number(req.params.id);
  const { name, address, active } = req.body;
  const location = await prisma.location.update({
    where: { id },
    data: { name, address, active },
  });
  res.json(location);
}

export async function deleteLocation(req, res) {
  const id = Number(req.params.id);
  await prisma.location.delete({ where: { id } });
  res.status(204).send();
}

export async function toggleLocation(req, res) {
  const id = Number(req.params.id);
  const location = await prisma.location.findUnique({ where: { id } });
  if (!location) return res.status(404).json({ error: 'Location not found' });
  const updated = await prisma.location.update({ where: { id }, data: { active: !location.active } });
  res.json(updated);
}

export async function listMenus(req, res) {
  const menus = await prisma.menu.findMany({ where: { brand_id: req.user.brandId } });
  res.json(menus);
}

export async function createMenu(req, res) {
  const { name, active = true, location_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Menu name is required' });
  const menu = await prisma.menu.create({
    data: { name, active, brand_id: req.user.brandId, location_id: location_id || null },
  });
  res.status(201).json(menu);
}

export async function updateMenu(req, res) {
  const id = Number(req.params.id);
  const { name, active, location_id } = req.body;
  const menu = await prisma.menu.update({
    where: { id },
    data: { name, active, location_id: location_id || null },
  });
  res.json(menu);
}

export async function deleteMenu(req, res) {
  const id = Number(req.params.id);
  await prisma.menu.delete({ where: { id } });
  res.status(204).send();
}

export async function uploadMenu(req, res) {
  const menuId = Number(req.body.menu_id);
  const menu = await prisma.menu.findUnique({ where: { id: menuId } });
  if (!menu) return res.status(404).json({ error: 'Menu not found' });
  if (!req.file) return res.status(400).json({ error: 'File is required' });

  const rows = parseUploadedSheet(req.file.buffer);
  if (!rows.length) return res.status(400).json({ error: 'Uploaded file is empty or invalid' });

  const categoriesMap = new Map();

  for (const row of rows) {
    const categoryName = row.category?.trim() || 'General';
    const categoryKey = categoryName.toLowerCase();
    if (!categoriesMap.has(categoryKey)) {
      const category = await prisma.category.create({
        data: {
          menu_id: menuId,
          name: { en: categoryName },
          sort_order: categoriesMap.size,
        },
      });
      categoriesMap.set(categoryKey, category.id);
    }
    const categoryId = categoriesMap.get(categoryKey);
    const itemData = {
      category_id: categoryId,
      name: { en: row.name || `Item ${Date.now()}` },
      description: { en: row.description || '' },
      price: Number(row.price || 0),
      image_url: row.image_url || null,
      available: row.available === false || row.available === 'false' ? false : true,
    };
    const item = await prisma.item.create({ data: itemData });
    if (row.choice_json) {
      await prisma.itemChoice.create({ data: { item_id: item.id, label: { en: row.choice_label || 'Choice' }, options: JSON.parse(row.choice_json) } });
    }
    if (row.addon_json) {
      await prisma.itemAddon.create({ data: { item_id: item.id, label: { en: row.addon_label || 'Addon' }, extra_price: Number(row.addon_price || 0) } });
    }
    if (row.size_json) {
      await prisma.itemSize.create({ data: { item_id: item.id, label: { en: row.size_label || 'Size' }, price: Number(row.size_price || 0) } });
    }
  }

  res.status(201).json({ message: 'Menu imported successfully' });
}

export async function listCategories(req, res) {
  const menuId = Number(req.params.id);
  const categories = await prisma.category.findMany({ where: { menu_id: menuId }, orderBy: { sort_order: 'asc' } });
  res.json(categories);
}

export async function createCategory(req, res) {
  const menuId = Number(req.params.id);
  const { name, sort_order = 0, active = true } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  const category = await prisma.category.create({ data: { menu_id: menuId, name, sort_order, active } });
  res.status(201).json(category);
}

export async function updateCategory(req, res) {
  const id = Number(req.params.id);
  const { name, sort_order, active } = req.body;
  const category = await prisma.category.update({ where: { id }, data: { name, sort_order, active } });
  res.json(category);
}

export async function deleteCategory(req, res) {
  const id = Number(req.params.id);
  await prisma.category.delete({ where: { id } });
  res.status(204).send();
}

export async function listItems(req, res) {
  const categoryId = Number(req.params.id);
  const items = await prisma.item.findMany({ where: { category_id: categoryId }, include: { choices: true, addons: true, sizes: true } });
  res.json(items);
}

export async function createItem(req, res) {
  const categoryId = Number(req.params.id);
  const { name, description, price, image_url, available = true, choices, addons, sizes } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Name and price are required' });
  const item = await prisma.item.create({ data: { category_id: categoryId, name, description: description || {}, price: Number(price), image_url, available } });
  if (choices && Array.isArray(choices)) {
    for (const choice of choices) {
      await prisma.itemChoice.create({ data: { item_id: item.id, label: choice.label || {}, options: choice.options || [] } });
    }
  }
  if (addons && Array.isArray(addons)) {
    for (const addon of addons) {
      await prisma.itemAddon.create({ data: { item_id: item.id, label: addon.label || {}, extra_price: Number(addon.extra_price || 0) } });
    }
  }
  if (sizes && Array.isArray(sizes)) {
    for (const size of sizes) {
      await prisma.itemSize.create({ data: { item_id: item.id, label: size.label || {}, price: Number(size.price || 0) } });
    }
  }
  const created = await prisma.item.findUnique({ where: { id: item.id }, include: { choices: true, addons: true, sizes: true } });
  res.status(201).json(created);
}

export async function updateItem(req, res) {
  const id = Number(req.params.id);
  const { name, description, price, image_url, available, choices, addons, sizes } = req.body;
  const item = await prisma.item.update({ where: { id }, data: { name, description, price: price === undefined ? undefined : Number(price), image_url, available } });
  if (choices && Array.isArray(choices)) {
    await prisma.itemChoice.deleteMany({ where: { item_id: item.id } });
    for (const choice of choices) {
      await prisma.itemChoice.create({ data: { item_id: item.id, label: choice.label || {}, options: choice.options || [] } });
    }
  }
  if (addons && Array.isArray(addons)) {
    await prisma.itemAddon.deleteMany({ where: { item_id: item.id } });
    for (const addon of addons) {
      await prisma.itemAddon.create({ data: { item_id: item.id, label: addon.label || {}, extra_price: Number(addon.extra_price || 0) } });
    }
  }
  if (sizes && Array.isArray(sizes)) {
    await prisma.itemSize.deleteMany({ where: { item_id: item.id } });
    for (const size of sizes) {
      await prisma.itemSize.create({ data: { item_id: item.id, label: size.label || {}, price: Number(size.price || 0) } });
    }
  }
  const updated = await prisma.item.findUnique({ where: { id }, include: { choices: true, addons: true, sizes: true } });
  res.json(updated);
}

export async function deleteItem(req, res) {
  const id = Number(req.params.id);
  await prisma.item.delete({ where: { id } });
  res.status(204).send();
}

export async function toggleItem(req, res) {
  const id = Number(req.params.id);
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const updated = await prisma.item.update({ where: { id }, data: { available: !item.available } });
  res.json(updated);
}

export async function listTables(req, res) {
  const locationId = Number(req.query.location_id);
  if (!locationId) return res.status(400).json({ error: 'location_id is required' });
  const tables = await prisma.table.findMany({ where: { location_id: locationId } });
  res.json(tables);
}

export async function createTable(req, res) {
  const { location_id, number } = req.body;
  if (!location_id || !number) return res.status(400).json({ error: 'location_id and number are required' });
  const qrText = `fine-dine://table/${location_id}/${number}/${Date.now()}`;
  const qrImageUrl = await QRCode.toDataURL(qrText);
  const table = await prisma.table.create({ data: { location_id: Number(location_id), number: String(number), qr_text: qrText, qr_image_url: qrImageUrl, active: true } });
  res.status(201).json(table);
}

export async function getTableQr(req, res) {
  const id = Number(req.params.id);
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) return res.status(404).json({ error: 'Table not found' });
  res.json({ qr_text: table.qr_text, qr_image_url: table.qr_image_url });
}

export async function regenerateTableQr(req, res) {
  const id = Number(req.params.id);
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) return res.status(404).json({ error: 'Table not found' });
  const qrText = `fine-dine://table/${table.location_id}/${table.number}/${Date.now()}`;
  const qrImageUrl = await QRCode.toDataURL(qrText);
  const updated = await prisma.table.update({ where: { id }, data: { qr_text: qrText, qr_image_url: qrImageUrl } });
  res.json(updated);
}

export async function deleteTable(req, res) {
  const id = Number(req.params.id);
  await prisma.table.delete({ where: { id } });
  res.status(204).send();
}

export async function listCaptains(req, res) {
  const captains = await prisma.captain.findMany({ where: { brand_id: req.user.brandId } });
  res.json(captains);
}

export async function createCaptain(req, res) {
  const { name, email, password, location_id, active = true } = req.body;
  if (!name || !email || !password || !location_id) return res.status(400).json({ error: 'Name, email, password, and location_id are required' });
  const hashed = await bcrypt.hash(password, 10);
  const captain = await prisma.captain.create({ data: { name, email, password: hashed, location_id: Number(location_id), brand_id: req.user.brandId, active } });
  res.status(201).json(captain);
}

export async function updateCaptain(req, res) {
  const id = Number(req.params.id);
  const { name, email, password, location_id, active } = req.body;
  const data = { name, email, location_id: location_id ? Number(location_id) : undefined, active };
  if (password) data.password = await bcrypt.hash(password, 10);
  const captain = await prisma.captain.update({ where: { id }, data });
  res.json(captain);
}

export async function deleteCaptain(req, res) {
  const id = Number(req.params.id);
  await prisma.captain.delete({ where: { id } });
  res.status(204).send();
}

export async function toggleCaptain(req, res) {
  const id = Number(req.params.id);
  const captain = await prisma.captain.findUnique({ where: { id } });
  if (!captain) return res.status(404).json({ error: 'Captain not found' });
  const updated = await prisma.captain.update({ where: { id }, data: { active: !captain.active } });
  res.json(updated);
}

export async function listOffers(req, res) {
  const locationId = Number(req.query.location_id);
  if (!locationId) return res.status(400).json({ error: 'location_id is required' });
  const offers = await prisma.offer.findMany({ where: { location_id: locationId } });
  res.json(offers);
}

export async function createOffer(req, res) {
  const { location_id, internal_name, display_label, type, settings, start_date, end_date, active_hours_start, active_hours_end, visibility, coupon_code, status } = req.body;
  if (!location_id || !internal_name || !display_label || !type || !settings || !start_date || !end_date || !visibility) {
    return res.status(400).json({ error: 'location_id, internal_name, display_label, type, settings, start_date, end_date and visibility are required' });
  }
  const offer = await prisma.offer.create({
    data: {
      location_id: Number(location_id),
      internal_name,
      display_label,
      type,
      settings: typeof settings === 'string' ? JSON.parse(settings) : settings,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      active_hours_start,
      active_hours_end,
      visibility,
      coupon_code,
      status: status || 'ACTIVE',
    },
  });
  res.status(201).json(offer);
}

export async function updateOffer(req, res) {
  const id = Number(req.params.id);
  const { internal_name, display_label, type, settings, start_date, end_date, active_hours_start, active_hours_end, visibility, coupon_code, status } = req.body;
  const offer = await prisma.offer.update({
    where: { id },
    data: {
      internal_name,
      display_label,
      type,
      settings: settings ? (typeof settings === 'string' ? JSON.parse(settings) : settings) : undefined,
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
      active_hours_start,
      active_hours_end,
      visibility,
      coupon_code,
      status,
    },
  });
  res.json(offer);
}

export async function deleteOffer(req, res) {
  const id = Number(req.params.id);
  await prisma.offer.delete({ where: { id } });
  res.status(204).send();
}

export async function toggleOffer(req, res) {
  const id = Number(req.params.id);
  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  const nextStatus = offer.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
  const updated = await prisma.offer.update({ where: { id }, data: { status: nextStatus } });
  res.json(updated);
}

async function getGuestMenu(brandSlug, locationId, tableId) {
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) throw { status: 404, message: 'Brand not found' };
  const location = await prisma.location.findFirst({ where: { id: Number(locationId), brand_id: brand.id, active: true } });
  if (!location) throw { status: 404, message: 'Location not found or inactive' };
  const table = await prisma.table.findFirst({ where: { id: Number(tableId), location_id: location.id, active: true } });
  if (!table) throw { status: 404, message: 'Table not found or inactive' };
  const menus = await prisma.menu.findMany({ where: { brand_id: brand.id, OR: [{ location_id: null }, { location_id: location.id }], active: true }, include: { categories: { where: { active: true }, orderBy: { sort_order: 'asc' }, include: { items: { where: { available: true }, include: { choices: true, addons: true, sizes: true } } } } } });
  return { brand, location, table, menus };
}

export async function getPublicMenu(req, res) {
  const { brand_slug, location_id, table_id } = req.params;
  try {
    const data = await getGuestMenu(brand_slug, location_id, table_id);
    res.json(data);
  } catch (error) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
    } else {
      console.error('Error in getPublicMenu:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

async function createOrderRecords(orderId, items) {
  const createdItems = [];
  for (const item of items) {
    if (!item.item_id || !item.quantity || item.quantity <= 0) {
      throw { status: 400, message: 'Each order item must include item_id and quantity' };
    }
    const target = await prisma.item.findUnique({ where: { id: Number(item.item_id) } });
    if (!target) throw { status: 404, message: `Item ${item.item_id} not found` };
    const unitPrice = Number(item.unit_price ?? target.price);
    const created = await prisma.orderItem.create({ data: { order_id: orderId, item_id: Number(item.item_id), quantity: Number(item.quantity), selected_choice: item.selected_choice || null, selected_addons: item.selected_addons || null, selected_size: item.selected_size || null, unit_price: unitPrice } });
    if (item.notes && Array.isArray(item.notes)) {
      for (const note of item.notes) {
        await prisma.orderItemNote.create({ data: { order_item_id: created.id, note } });
      }
    }
    createdItems.push(created);
  }
  return createdItems;
}

export async function createOrder(req, res) {
  const { location_id, table_id, items, notes, guest_info } = req.body;
  if (!location_id || !table_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'location_id, table_id and items are required' });
  }
  const location = await prisma.location.findUnique({ where: { id: Number(location_id) } });
  if (!location || !location.active) return res.status(404).json({ error: 'Location not found or inactive' });
  const table = await prisma.table.findUnique({ where: { id: Number(table_id) } });
  if (!table || table.location_id !== Number(location_id) || !table.active) return res.status(404).json({ error: 'Table not found or inactive for this location' });

  const order = await prisma.order.create({ data: { location_id: Number(location_id), table_id: Number(table_id), status: 'PENDING' } });
  await createOrderRecords(order.id, items);
  if (Array.isArray(notes)) {
    for (const note of notes) {
      await prisma.orderNote.create({ data: { order_id: order.id, note } });
    }
  }
  if (guest_info && typeof guest_info === 'object') {
    const { name, email, phone } = guest_info;
    if (name || email || phone) {
      await prisma.guestInfo.create({ data: { order_id: order.id, name: name || null, email: email || null, phone: phone || null } });
    }
  }

  const created = await prisma.order.findUnique({ where: { id: order.id }, include: { orderItems: true, notes: true, guestInfo: true } });
  const orderPayload = {
    order_id: created.id,
    table_number: table.number,
    items: created.orderItems,
    notes: created.notes,
    submitted_at: created.created_at,
  };
  emitLocation(location.id, 'new_order', orderPayload);
  res.status(201).json(created);
}

export async function updateOrder(req, res) {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id }, include: { orderItems: true } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING') return res.status(403).json({ error: 'Only pending orders can be edited' });
  const { items, notes, guest_info } = req.body;
  if (items && Array.isArray(items)) {
    const currentItemIds = (await prisma.orderItem.findMany({ where: { order_id: order.id }, select: { id: true } })).map((row) => row.id);
    if (currentItemIds.length) {
      await prisma.orderItemNote.deleteMany({ where: { order_item_id: { in: currentItemIds } } });
    }
    await prisma.orderItem.deleteMany({ where: { order_id: order.id } });
    await createOrderRecords(order.id, items);
  }
  if (Array.isArray(notes)) {
    await prisma.orderNote.deleteMany({ where: { order_id: order.id } });
    for (const note of notes) {
      await prisma.orderNote.create({ data: { order_id: order.id, note } });
    }
  }
  if (guest_info && typeof guest_info === 'object') {
    const guest = await prisma.guestInfo.findUnique({ where: { order_id: order.id } });
    const guestData = { name: guest_info.name || null, email: guest_info.email || null, phone: guest_info.phone || null };
    if (guest) {
      await prisma.guestInfo.update({ where: { order_id: order.id }, data: guestData });
    } else if (guest_info.name || guest_info.email || guest_info.phone) {
      await prisma.guestInfo.create({ data: { order_id: order.id, ...guestData } });
    }
  }
  const latest = await prisma.order.findUnique({ where: { id: order.id }, include: { orderItems: true, notes: true, guestInfo: true, table: true, location: true } });
  emitLocation(latest.location_id, 'order_updated', { order_id: latest.id, latest_order: latest });
  res.json(latest);
}

export async function cancelOrder(req, res) {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id }, include: { table: true } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING') return res.status(403).json({ error: 'Only pending orders can be canceled' });
  const updated = await prisma.order.update({ where: { id }, data: { status: 'CANCELED_BY_GUEST' } });
  emitLocation(order.location_id, 'order_canceled', { order_id: updated.id, table_number: order.table?.number });
  res.json(updated);
}

export async function acceptOrder(req, res) {
  const id = Number(req.params.id);
  const { estimated_minutes } = req.body;
  if (estimated_minutes === undefined) return res.status(400).json({ error: 'estimated_minutes is required' });
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING') return res.status(403).json({ error: 'Only pending orders can be accepted' });
  if (!validateLocationAccess(req.user, order.location_id)) return res.status(403).json({ error: 'Captain may only accept orders for own location' });
  const updated = await prisma.order.update({ where: { id }, data: { status: 'ACCEPTED', estimated_minutes: Number(estimated_minutes) } });
  emitOrder(updated.id, 'order_accepted', { order_id: updated.id, estimated_minutes: updated.estimated_minutes });
  res.json(updated);
}

export async function getOrder(req, res) {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id }, include: { orderItems: { include: { notes: true } }, notes: true, guestInfo: true, table: true } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
}

export async function listOrders(req, res) {
  const locationId = Number(req.query.location_id);
  if (!locationId) return res.status(400).json({ error: 'location_id is required' });
  if (!validateLocationAccess(req.user, locationId)) return res.status(403).json({ error: 'Access denied for this location' });
  const where = { location_id: locationId, status: req.query.status ? String(req.query.status) : undefined };
  const { skip, take } = buildPagination(req.query);
  const orders = await prisma.order.findMany({ where, include: { table: true }, orderBy: { created_at: 'desc' }, skip, take });
  res.json(orders);
}

export async function createBillRequest(req, res) {
  const { order_id, payment_method } = req.body;
  if (!order_id || !payment_method) return res.status(400).json({ error: 'order_id and payment_method are required' });
  const order = await prisma.order.findUnique({ where: { id: Number(order_id) }, include: { orderItems: true, table: true } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'ACCEPTED') return res.status(403).json({ error: 'Bill request only allowed for accepted orders' });
  const existing = await prisma.billRequest.findFirst({ where: { order_id: order.id, status: 'PENDING' } });
  if (existing) return res.status(409).json({ error: 'There is already a pending bill request for this order' });
  const billRequest = await prisma.billRequest.create({ data: { order_id: order.id, table_id: order.table_id, location_id: order.location_id, payment_method, status: 'PENDING' } });
  const orderTotal = computeOrderTotal(order.orderItems);
  emitLocation(order.location_id, 'bill_requested', { bill_request_id: billRequest.id, order_id: order.id, table_number: order.table.number, payment_method, order_total: orderTotal });
  res.status(201).json({ bill_request_id: billRequest.id, order_total: orderTotal, payment_method });
}

export async function markBillDone(req, res) {
  const id = Number(req.params.id);
  const billRequest = await prisma.billRequest.findUnique({ where: { id } });
  if (!billRequest) return res.status(404).json({ error: 'Bill request not found' });
  if (!validateLocationAccess(req.user, billRequest.location_id)) return res.status(403).json({ error: 'Access denied for this bill request' });
  const updated = await prisma.billRequest.update({ where: { id }, data: { status: 'DONE', done_at: new Date() } });
  emitOrder(updated.order_id, 'bill_done', { bill_request_id: updated.id });
  res.json(updated);
}

export async function listBillRequests(req, res) {
  const locationId = Number(req.query.location_id);
  if (!locationId) return res.status(400).json({ error: 'location_id is required' });
  if (!validateLocationAccess(req.user, locationId)) return res.status(403).json({ error: 'Access denied for this location' });
  const where = { location_id: locationId, status: req.query.status ? String(req.query.status) : undefined };
  const billRequests = await prisma.billRequest.findMany({ where, include: { order: true, table: true }, orderBy: { requested_at: 'desc' } });
  res.json(billRequests);
}

export async function analyticsOrders(req, res) {
  const { from, to, location_id } = req.query;
  const where = { location_id: location_id ? Number(location_id) : undefined, created_at: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } };
  const count = await prisma.order.count({ where });
  res.json({ total_orders: count, from, to, location_id: location_id ? Number(location_id) : undefined });
}

export async function analyticsCancellations(req, res) {
  const { from, to, location_id } = req.query;
  const where = { location_id: location_id ? Number(location_id) : undefined, status: 'CANCELED_BY_GUEST', created_at: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } };
  const count = await prisma.order.count({ where });
  res.json({ total_cancellations: count, from, to, location_id: location_id ? Number(location_id) : undefined });
}

export async function analyticsMenuPerformance(req, res) {
  const { from, to, location_id } = req.query;
  const items = await prisma.orderItem.groupBy({ by: ['item_id'], _sum: { quantity: true }, _count: { item_id: true }, where: { order: { location_id: location_id ? Number(location_id) : undefined, created_at: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } } } });
  res.json({ items });
}

export async function analyticsCaptainPerformance(req, res) {
  const { from, to, location_id } = req.query;
  const orders = await prisma.order.findMany({ where: { location_id: location_id ? Number(location_id) : undefined, created_at: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } }, include: { table: true } });
  res.json({ total_orders: orders.length, from, to, location_id: location_id ? Number(location_id) : undefined });
}

export async function analyticsOffersPerformance(req, res) {
  const { from, to, location_id } = req.query;
  const offers = await prisma.offer.findMany({ where: { location_id: location_id ? Number(location_id) : undefined, start_date: { lte: to ? new Date(to) : undefined }, end_date: { gte: from ? new Date(from) : undefined } } });
  res.json({ offers, from, to, location_id: location_id ? Number(location_id) : undefined });
}

export async function analyticsExport(req, res) {
  const { report, format, from, to } = req.query;
  const reports = {
    orders: await prisma.order.findMany({ where: { created_at: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } } }),
    cancellations: await prisma.order.findMany({ where: { status: 'CANCELED_BY_GUEST', created_at: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } } }),
  };
  const data = reports[report] || [];
  if (format === 'csv') {
    const rows = [Object.keys(data[0] || {}).join(','), ...data.map((row) => Object.values(row).map((value) => JSON.stringify(value)).join(','))];
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename=${report || 'report'}.csv`);
    return res.send(rows.join('\n'));
  }
  if (format === 'excel') {
    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, report || 'report');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename=${report || 'report'}.xlsx`);
    return res.send(buffer);
  }
  res.status(400).json({ error: 'format must be csv or excel' });
}


// Re-export subscription controller functions
export {
  registerBrand,
  initiateSubscriptionPayment,
  paymobWebhook,
  getSubscriptionStatus,
  addBranchPayment,
  listBrands,
  activateBrand,
  suspendBrand,
} from './subscription.controller.js';


// Re-export section controller functions
export {
  listSections,
  createSection,
  updateSection,
  deleteSection,
  toggleSection,
  assignTablesToSection,
} from './section.controller.js';

// Re-export captainSession controller functions
export {
  getCaptainSections,
  startCaptainSession,
  getActiveSession,
  endCaptainSession,
  getCaptainSessionHistory,
    getCaptainOrders,
} from './captainSession.controller.js';
    createOrder,
  getOrder,
  listOrders,
  acceptOrder,
  cancelOrder,
  createBillRequest,
  completeBillRequest,
} from './order.controller.js';
  getCaptainOrders,
} from './captainSession.controller.js';
