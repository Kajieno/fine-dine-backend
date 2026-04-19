import { Server } from 'socket.io';

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('join_location', (locationId) => {
      if (!locationId) return;
      socket.join(`location_${locationId}`);
    });

    socket.on('join_order', (orderId) => {
      if (!orderId) return;
      socket.join(`order_${orderId}`);
    });
  });

  return io;
}

function ensureIo() {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
}

export function emitLocation(locationId, event, payload) {
  ensureIo().to(`location_${locationId}`).emit(event, payload);
}

export function emitOrder(orderId, event, payload) {
  ensureIo().to(`order_${orderId}`).emit(event, payload);
}
