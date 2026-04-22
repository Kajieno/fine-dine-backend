import prisma from '../lib/prisma.js';
import { emitLocation, emitOrder } from '../socket/socket.handler.js';

// Helper: build order include object
const orderInclude = {
  orderItems: {
    include: {
      item: { select: { id: true, name: true, image_url: true } },
    },
  },
  table: { select: { id: true, table_number: true, section: { select: { id: true, name: true } } } },
  guestInfo: true,
  notes: true,
  billRequests: true,
};

// Helper: compute total
function computeTotal(items) {
  return items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
}

// POST /api/orders  — customer places order (public)
export async function createOrder(req, res) {
  try {
    const { location_id, table_id, items, notes, guest_info } = req.body;
    if (!location_id || !table_id || !items?.length) {
      return res.status(400).json({ error: 'location_id, table_id and items are required' });
    }

    // Validate table belongs to location
    const table = await prisma.table.findFirst({
      where: { id: Number(table_id), location_id: Number(location_id) },
    });
    if (!table) return res.status(404).json({ error: 'Table not found in this location' });

    // Fetch item prices
    const itemIds = items.map((i) => Number(i.item_id));
    const dbItems = await prisma.item.findMany({ where: { id: { in: itemIds } } });
    if (dbItems.length !== itemIds.length) {
      return res.status(400).json({ error: 'One or more items not found' });
    }

    const priceMap = Object.fromEntries(dbItems.map((i) => [i.id, i.price]));

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          location_id: Number(location_id),
          table_id: Number(table_id),
          status: 'PENDING',
          orderItems: {
            create: items.map((i) => ({
              item_id: Number(i.item_id),
              quantity: Number(i.quantity),
              unit_price: priceMap[Number(i.item_id)],
              selected_choice: i.selected_choice ?? null,
              selected_addons: i.selected_addons ?? null,
              selected_size: i.selected_size ?? null,
            })),
          },
          ...(notes?.length && {
            notes: { create: notes.map((n) => ({ note: n })) },
          }),
          ...(guest_info && {
            guestInfo: { create: guest_info },
          }),
        },
        include: orderInclude,
      });
      return newOrder;
    });

    // Emit real-time event to captains in this location
    emitLocation(location_id, 'new_order', {
      order_id: order.id,
      table_number: table.table_number,
      items_count: items.length,
      total: computeTotal(order.orderItems),
      created_at: order.created_at,
    });

    return res.status(201).json({ success: true, order });
  } catch (err) {
    console.error('createOrder error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/orders/:id
export async function getOrder(req, res) {
  try {
    const id = Number(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json({ order, total: computeTotal(order.orderItems) });
  } catch (err) {
    console.error('getOrder error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/orders?location_id=&status=&page=&limit=
export async function listOrders(req, res) {
  try {
    const { location_id, status, page = 1, limit = 20 } = req.query;
    if (!location_id) return res.status(400).json({ error: 'location_id is required' });

    const where = { location_id: Number(location_id) };
    if (status) where.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    return res.json({
      orders: orders.map((o) => ({ ...o, total: computeTotal(o.orderItems) })),
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    console.error('listOrders error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/orders/:id  — captain accepts order
export async function acceptOrder(req, res) {
  try {
    const id = Number(req.params.id);
    const { estimated_minutes } = req.body;
    if (estimated_minutes === undefined) {
      return res.status(400).json({ error: 'estimated_minutes is required' });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only PENDING orders can be accepted' });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'ACCEPTED', estimated_minutes: Number(estimated_minutes) },
      include: orderInclude,
    });

    emitLocation(order.location_id, 'order_accepted', {
      order_id: id,
      estimated_minutes: updated.estimated_minutes,
    });
    emitOrder(id, 'order_accepted', {
      order_id: id,
      estimated_minutes: updated.estimated_minutes,
    });

    return res.json({ success: true, order: updated });
  } catch (err) {
    console.error('acceptOrder error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/orders/:id/cancel  — guest cancels pending order
export async function cancelOrder(req, res) {
  try {
    const id = Number(req.params.id);
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only PENDING orders can be cancelled' });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'CANCELED_BY_GUEST' },
      include: orderInclude,
    });

    emitLocation(order.location_id, 'order_canceled', { order_id: id });
    emitOrder(id, 'order_canceled', { order_id: id });

    return res.json({ success: true, order: updated });
  } catch (err) {
    console.error('cancelOrder error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/bill-request  — guest requests bill
export async function createBillRequest(req, res) {
  try {
    const { order_id, payment_method } = req.body;
    if (!order_id || !payment_method) {
      return res.status(400).json({ error: 'order_id and payment_method are required' });
    }

    const order = await prisma.order.findUnique({ where: { id: Number(order_id) } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'ACCEPTED') {
      return res.status(400).json({ error: 'Bill can only be requested for ACCEPTED orders' });
    }

    const billRequest = await prisma.billRequest.create({
      data: {
        order_id: Number(order_id),
        payment_method,
        status: 'PENDING',
      },
    });

    emitLocation(order.location_id, 'bill_requested', {
      order_id: Number(order_id),
      payment_method,
      bill_request_id: billRequest.id,
    });

    return res.status(201).json({ success: true, billRequest });
  } catch (err) {
    console.error('createBillRequest error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/bill-request/:id/done  — captain marks bill as done
export async function completeBillRequest(req, res) {
  try {
    const id = Number(req.params.id);
    const billRequest = await prisma.billRequest.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!billRequest) return res.status(404).json({ error: 'Bill request not found' });

    const updated = await prisma.billRequest.update({
      where: { id },
      data: { status: 'DONE' },
    });

    emitOrder(billRequest.order_id, 'bill_done', { order_id: billRequest.order_id });

    return res.json({ success: true, billRequest: updated });
  } catch (err) {
    console.error('completeBillRequest error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
