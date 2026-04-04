import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { UserPayload } from '../types';

// Registries for active WebSocket connections
const activeCustomerSockets = new Map<string, Set<any>>();
const activeVendorSockets = new Map<string, Set<any>>();

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.get('/history/:vendorId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const { vendorId } = request.params as { vendorId: string };
    
    return prisma.chatMessage.findMany({
      where: {
        senderId: user.id, // senderId is always the customer ID
        vendorId: vendorId
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  // Fetch unique chat contacts for a vendor
  fastify.get('/vendor/contacts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as UserPayload;
    if (user.role !== 'VENDOR') return reply.code(403).send({ error: 'Vendor only' });

    const vendorProfile = await prisma.vendorProfile.findUnique({ where: { userId: user.id } });
    if (!vendorProfile) return [];

    // Get unique customers who have chatted with this vendor
    const messages = await prisma.chatMessage.findMany({
      where: { vendorId: vendorProfile.id },
      select: { sender: { select: { id: true, firstName: true, lastName: true } } },
      distinct: ['senderId']
    });

    return messages.map(m => m.sender);
  });

  // Fetch chat history with a specific customer for a vendor
  fastify.get('/vendor/history/:customerId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const { customerId } = request.params as { customerId: string };
    if (user.role !== 'VENDOR') return reply.code(403).send({ error: 'Vendor only' });

    const vendorProfile = await prisma.vendorProfile.findUnique({ where: { userId: user.id } });
    if (!vendorProfile) return [];

    return prisma.chatMessage.findMany({
      where: {
        senderId: customerId, // Customer ID
        vendorId: vendorProfile.id
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  // WebSocket Live Connection
  fastify.get('/ws/:vendorId', { websocket: true }, async (connection, req) => {
    const { socket } = connection;
    const { vendorId } = req.params as { vendorId: string };
    const query = req.query as { token?: string };
    
    if (!query.token) {
      socket.send(JSON.stringify({ error: 'Auth token required' }));
      return socket.close(1008, 'Auth Required');
    }

    let user: UserPayload;
    try {
      user = fastify.jwt.verify(query.token) as UserPayload;
    } catch (err) {
      return socket.close(1008, 'Invalid Token');
    }

    // Register active socket based on role
    if (user.role === 'VENDOR') {
      if (!activeVendorSockets.has(vendorId)) activeVendorSockets.set(vendorId, new Set());
      activeVendorSockets.get(vendorId)?.add(socket);
    } else {
      if (!activeCustomerSockets.has(user.id)) activeCustomerSockets.set(user.id, new Set());
      activeCustomerSockets.get(user.id)?.add(socket);
    }

    socket.on('message', async (data: Buffer) => {
      try {
        const payloadStr = data.toString();
        let payload: { content: string, customerId?: string };
        
        try {
          payload = JSON.parse(payloadStr);
        } catch {
          // Fallback if plain text from old client
          payload = { content: payloadStr };
        }

        const msgContent = payload.content;
        const targetCustomerId = user.role === 'VENDOR' ? payload.customerId : user.id;
        
        if (!targetCustomerId) return; // Vendor must attach customerId to their payload

        // Save to DB
        const savedMessage = await prisma.chatMessage.create({
          data: {
            senderId: targetCustomerId,
            vendorId,
            content: msgContent,
            isFromVendor: user.role === 'VENDOR'
          }
        });

        const msgJson = JSON.stringify(savedMessage);

        // Broadcast to all active sockets of the customer
        activeCustomerSockets.get(targetCustomerId)?.forEach(s => {
          if (s.readyState === 1) s.send(msgJson);
        });

        // Broadcast to all active sockets of the vendor
        activeVendorSockets.get(vendorId)?.forEach(s => {
          if (s.readyState === 1) s.send(msgJson);
        });

      } catch (err) {
        console.error('Chat routing error', err);
      }
    });

    socket.on('close', () => {
      if (user.role === 'VENDOR') {
        activeVendorSockets.get(vendorId)?.delete(socket);
      } else {
        activeCustomerSockets.get(user.id)?.delete(socket);
      }
    });
  });
}
