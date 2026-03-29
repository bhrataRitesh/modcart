import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@modcart/db';
import { hashPassword, verifyPassword } from '@modcart/core';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string(),
  lastName: z.string(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return reply.code(400).send({ message: 'User already exists' });
    }

    const hashedPassword = await hashPassword(body.password);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: hashedPassword,
        firstName: body.firstName,
        lastName: body.lastName,
      },
    });

    return { id: user.id, email: user.email };
  });

  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user || !user.passwordHash) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }

    const isValid = await verifyPassword(body.password, user.passwordHash);

    if (!isValid) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return { 
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    };
  });

  // Get full user profile
  fastify.get('/me', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const userJwt = request.user as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: userJwt.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        addresses: true,
      }
    });

    if (!user) return reply.code(404).send({ message: 'User not found' });
    return user;
  });

  // Update user profile
  fastify.put('/me', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const userJwt = request.user as { id: string };
    const body = request.body as any; 

    const user = await prisma.user.update({
      where: { id: userJwt.id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      }
    });
    return user;
  });

  // Add address
  fastify.post('/me/addresses', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const userJwt = request.user as { id: string };
    const body = request.body as any;

    const address = await prisma.address.create({
      data: {
        userId: userJwt.id,
        label: body.label,
        firstName: body.firstName,
        lastName: body.lastName,
        line1: body.line1,
        line2: body.line2,
        city: body.city,
        state: body.state,
        postalCode: body.postalCode,
        country: body.country,
        isDefault: body.isDefault || false,
      }
    });

    return address;
  });


}
