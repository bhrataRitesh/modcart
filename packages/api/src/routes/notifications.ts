import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { UserPayload } from '../types';

// Registry for active notification sockets
export const activeUserSockets = new Map<string, Set<any>>();

export default async function notificationRoutes(fastify: FastifyInstance) {
  // Fetch unread count
  fastify.get('/unread-count', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as UserPayload;
    const count = await prisma.notification.count({
      where: { userId: user.id, isRead: false }
    });
    return { count };
  });

  // Fetch all notifications
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as UserPayload;
    return prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  });

  // Mark as read
  fastify.patch('/:id/read', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as UserPayload;
    const { id } = request.params as { id: string };
    
    await prisma.notification.update({
      where: { id, userId: user.id },
      data: { isRead: true }
    });
    
    return { success: true };
  });

  // Mark all as read
  fastify.patch('/read-all', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as UserPayload;
    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true }
    });
    return { success: true };
  });

  // WebSocket for Live Notifications
  fastify.get('/ws', { websocket: true }, async (connection, req) => {
    const { socket } = connection;
    const query = req.query as { token?: string };

    if (!query.token) {
      socket.send(JSON.stringify({ error: 'Auth token required' }));
      return socket.close(1008, 'Auth Required');
    }

    let user: UserPayload;
    try {
      user = fastify.jwt.verify(query.token) as any;
    } catch (err) {
      return socket.close(1008, 'Invalid Token');
    }

    // Register socket
    if (!activeUserSockets.has(user.id)) {
      activeUserSockets.set(user.id, new Set());
    }
    activeUserSockets.get(user.id)?.add(socket);

    socket.on('close', () => {
      activeUserSockets.get(user.id)?.delete(socket);
      if (activeUserSockets.get(user.id)?.size === 0) {
        activeUserSockets.delete(user.id);
      }
    });

    // Send initial ping or unread count
    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, isRead: false }
    });
    socket.send(JSON.stringify({ type: 'INITIAL_STATE', unreadCount }));
  });
}
