import prisma from '../lib/prisma.js';

// List all sections for a location
export async function listSections(req, res) {
  try {
    const { locationId } = req.params;
    const sections = await prisma.section.findMany({
      where: { location_id: Number(locationId) },
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

// Create a section for a location
export async function createSection(req, res) {
  try {
    const { locationId } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    // Verify location belongs to this brand
    const location = await prisma.location.findFirst({
      where: { id: Number(locationId), brand_id: req.user.brand_id },
    });
    if (!location) return res.status(404).json({ error: 'Location not found' });

    const section = await prisma.section.create({
      data: {
        location_id: Number(locationId),
        name,
      },
    });
    res.status(201).json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Update a section
export async function updateSection(req, res) {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const existing = await prisma.section.findFirst({
      where: {
        id: Number(id),
        location: { brand_id: req.user.brand_id },
      },
    });
    if (!existing) return res.status(404).json({ error: 'Section not found' });

    const section = await prisma.section.update({
      where: { id: Number(id) },
      data: { name },
    });
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Delete a section
export async function deleteSection(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.section.findFirst({
      where: {
        id: Number(id),
        location: { brand_id: req.user.brand_id },
      },
    });
    if (!existing) return res.status(404).json({ error: 'Section not found' });

    // Unlink tables from this section before deleting
    await prisma.table.updateMany({
      where: { section_id: Number(id) },
      data: { section_id: null },
    });

    await prisma.section.delete({ where: { id: Number(id) } });
    res.json({ message: 'Section deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Toggle section active/inactive
export async function toggleSection(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.section.findFirst({
      where: {
        id: Number(id),
        location: { brand_id: req.user.brand_id },
      },
    });
    if (!existing) return res.status(404).json({ error: 'Section not found' });

    const section = await prisma.section.update({
      where: { id: Number(id) },
      data: { active: !existing.active },
    });
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Assign tables range to a section (batch assign)
export async function assignTablesToSection(req, res) {
  try {
    const { id } = req.params;
    const { table_ids } = req.body; // array of table IDs

    if (!Array.isArray(table_ids) || table_ids.length === 0) {
      return res.status(400).json({ error: 'table_ids array is required' });
    }

    const existing = await prisma.section.findFirst({
      where: {
        id: Number(id),
        location: { brand_id: req.user.brand_id },
      },
    });
    if (!existing) return res.status(404).json({ error: 'Section not found' });

    await prisma.table.updateMany({
      where: {
        id: { in: table_ids.map(Number) },
        location_id: existing.location_id,
      },
      data: { section_id: Number(id) },
    });

    const updated = await prisma.section.findUnique({
      where: { id: Number(id) },
      include: { tables: true },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
