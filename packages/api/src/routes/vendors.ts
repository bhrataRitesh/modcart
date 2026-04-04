import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { validate } from '../middleware/validate';
import { registerVendorSchema } from '../schemas/vendor.schema';
import { UserPayload } from '../types';
import { z } from 'zod';

type RegisterVendorBody = z.infer<typeof registerVendorSchema>;

export default async function vendorRoutes(fastify: FastifyInstance) {
  // Public vendor registration (must be logged in as user)
  fastify.post('/register', { preHandler: [fastify.authenticate, validate(registerVendorSchema)] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const body = request.body as RegisterVendorBody;

    // Check if user already has a vendor profile
    const existing = await prisma.vendorProfile.findFirst({
      where: { userId: user.id }
    });

    if (existing) {
      return reply.code(400).send({ message: 'Vendor profile already exists for this user' });
    }

    // Check store name/slug uniqueness
    const nameExists = await prisma.vendorProfile.findFirst({
      where: { OR: [{ storeName: body.storeName }, { storeSlug: body.storeSlug }] }
    });

    if (nameExists) {
      return reply.code(400).send({ message: 'Store name or slug already taken' });
    }

    const vendor = await prisma.vendorProfile.create({
      data: {
        userId: user.id,
        storeName: body.storeName,
        storeSlug: body.storeSlug,
        description: body.description,
        businessEmail: body.businessEmail,
        businessPhone: body.businessPhone,
        taxId: body.taxId,
        kycDocuments: body.kycDocuments as any,
        status: 'PENDING'
      }
    });

    return vendor;
  });

  // Get current user's vendor profile
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as UserPayload;
    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: user.id }
    });

    if (!profile) return reply.code(404).send({ message: 'No vendor profile' });
    return profile;
  });
}
