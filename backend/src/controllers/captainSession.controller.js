import prisma from '../lib/prisma.js';

// Get available sections for captain's location
export async function getCaptainSections(req, res) {
  try {
    const captain = await prisma.captain.findUnique({
      where: { id: req.user.id },
      select: { location_id: true },
    });
    if (!captain) return res.status(404).json({ error: 'Captain not found' });

    const sections = await prisma.section.findMany({
      where: {
        location_id: captain.location_id,
        active: true,
      },
      include: {
        _count: { select: { tables: true } },
      },
      orderBy: { id: 'asc' },
    });
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Start a captain session (captain chooses a section at login)
export async function startCaptainSession(req, res) {
  try {
    const { section_id } = req.body;
    if (!section_id) return res.status(400).json({ error: 'section_id is required' });

    const captain = await prisma.captain.findUnique({
      where: { id: req.user.id },
      select: { id: true, location_id: true },
    });
    if (!captain) return res.status(404).json({ error: 'Captain not found' });

    // Verify section belongs to captain's location
    const section = await prisma.section.findFirst({
      where: {
        id: Number(section_id),
        location_id: captain.location_id,
        active: true,
      },
    });
    if (!section) return res.status(404).json({ error: 'Section not found or inactive' });

    // End any existing active session for this captain
    await prisma.captainSession.updateMany({
      where: { captain_id: captain.id, active: true },
      data: { active: false, ended_at: new Date() },
    });

    // Create new session
    const session = await prisma.captainSession.create({
      data: {
        captain_id: captain.id,
        section_id: Number(section_id),
      },
      include: {
        section: {
          include: {
            tables: { where: { active: true }, select: { id: true, number: true } },
          },
        },
      },
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get current active session for a captain
export async function getActiveSession(req, res) {
  try {
    const session = await prisma.captainSession.findFirst({
      where: { captain_id: req.user.id, active: true },
      include: {
        section: {
          include: {
            tables: { where: { active: true }, select: { id: true, number: true } },
          },
        },
      },
    });
    if (!session) return res.status(404).json({ error: 'No active session' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// End current active session
export async function endCaptainSession(req, res) {
  try {
    const updated = await prisma.captainSession.updateMany({
      where: { captain_id: req.user.id, active: true },
      data: { active: false, ended_at: new Date() },
    });
    if (updated.count === 0) {
      return res.status(404).json({ error: 'No active session to end' });
    }
    res.json({ message: 'Session ended' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get session history for a captain
export async function getCaptainSessionHistory(req, res) {
  try {
    const sessions = await prisma.captainSession.findMany({
      where: { captain_id: req.user.id },
      include: {
        section: { select: { id: true, name: true } },
      },
      orderBy: { started_at: 'desc' },
      take: 20,
    });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get pending orders for captain's active section
export async function getCaptainOrders(req, res) {
  try {
    // Find active session
    const session = await prisma.captainSession.findFirst({
      where: { captain_id: req.user.id, active: true },
      select: { section_id: true },
    });
    if (!session) return res.status(404).json({ error: 'No active session. Please choose a section first.' });

    // Get table IDs in this section
    const tables = await prisma.table.findMany({
      where: { section_id: session.section_id, active: true },
      select: { id: true },
    });
    const tableIds = tables.map((t) => t.id);

    const orders = await prisma.order.findMany({
      where: {
        table_id: { in: tableIds },
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      include: {
        table: { select: { id: true, number: true } },
        orderItems: {
          include: {
            item: { select: { id: true, name: true, price: true } },
          },
        },
        notes: true,
        guestInfo: true,
      },
      orderBy: { created_at: 'asc' },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
