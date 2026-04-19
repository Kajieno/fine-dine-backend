import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

function getTokenFromHeader(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  const parts = header.split(' ');
  return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
}

export function authenticateToken(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ error: 'Missing authentication token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}

export function requireCaptain(req, res, next) {
  if (!req.user || req.user.role !== 'captain') {
    return res.status(403).json({ error: 'Captain access required' });
  }
  return next();
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  return next();
}

export function requireCaptainLocation(req, res, next) {
  if (!req.user || req.user.role !== 'captain') {
    return res.status(403).json({ error: 'Captain access required' });
  }
  const locationId = Number(req.query.location_id || req.body.location_id || req.params.location_id);
  if (locationId && req.user.locationId !== locationId) {
    return res.status(403).json({ error: 'Access denied for this location' });
  }
  return next();
}
