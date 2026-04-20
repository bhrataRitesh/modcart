import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@modcart/db';
import { UserPayload } from '../types';
import { cache } from '../lib/cache';

export const requirePermission = (action: string) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as UserPayload;
    if (!user) return reply.code(401).send({ message: 'Unauthorized' });

    // SUPERADMIN always have access, no matter what permissions they have
    if (user.role === 'SUPERADMIN') return;

    // Fast path: check permissions embedded in JWT token
    if (user.permissions && Array.isArray(user.permissions)) {
      if (user.permissions.includes(action)) return;
      return reply.code(403).send({ message: 'Forbidden: Missing required permission' });
    }

    // Fallback: fetch from DB + cache (for older tokens without embedded permissions)
    const CACHE_KEY = `permissions:${user.id}`;
    let permissions = await cache.get<string[]>(CACHE_KEY);

    if (!permissions) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          groups: {
            include: { permissions: true }
          }
        } as any
      }) as any;

      if (!dbUser) return reply.code(401).send({ message: 'Unauthorized' });

      permissions = dbUser.groups.flatMap((g: any) => g.permissions.map((p: any) => p.action));
      await cache.set(CACHE_KEY, permissions, 3600);
    }

    if (!permissions!.includes(action)) {
      return reply.code(403).send({ message: 'Forbidden: Missing required permission' });
    }
  };
};

export const requireRole = (roles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as UserPayload;
    if (!user || !roles.includes(user.role)) {
      return reply.code(403).send({ message: 'Forbidden: Insufficient permissions' });
    }
  };
};

export const requireOwnership = (model: 'product' | 'order' | 'vendorProfile', idParam: string = 'id') => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as UserPayload;
    const params = request.params as Record<string, string>;
    const resourceId = params[idParam];

    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') return;

    if (model === 'product') {
      const product = await prisma.product.findUnique({
        where: resourceId.startsWith('c') ? { id: resourceId } : { slug: resourceId },
        select: { vendor: { select: { userId: true } } }
      });
      if (!product || product.vendor.userId !== user.id) {
        return reply.code(403).send({ message: 'Forbidden: You do not own this product' });
      }
    }

    if (model === 'vendorProfile') {
      const vendor = await prisma.vendorProfile.findUnique({
        where: resourceId.startsWith('c') ? { id: resourceId } : { storeSlug: resourceId },
        select: { userId: true }
      });
      if (!vendor || vendor.userId !== user.id) {
        return reply.code(403).send({ message: 'Forbidden: You do not own this vendor profile' });
      }
    }

    if (model === 'order') {
       const order = await prisma.order.findUnique({
         where: { id: resourceId },
         select: { userId: true }
       });
       if (!order || order.userId !== user.id) {
         return reply.code(403).send({ message: 'Forbidden: You do not own this order' });
       }
    }
  };
};
