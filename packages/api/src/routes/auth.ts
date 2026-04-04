import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { hashPassword, verifyPassword } from '@modcart/core';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, updateMeSchema, addressSchema } from '../schemas/auth.schema';
import { z } from 'zod';
import { UserPayload } from '../types';
import crypto from 'crypto';

type RegisterBody = z.infer<typeof registerSchema>;
type LoginBody = z.infer<typeof loginSchema>;
type UpdateMeBody = z.infer<typeof updateMeSchema>;
type AddressBody = z.infer<typeof addressSchema>;

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', { preHandler: [validate(registerSchema)] }, async (request, reply) => {
    const body = request.body as RegisterBody;

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

  fastify.post('/login', { preHandler: [validate(loginSchema)] }, async (request, reply) => {
    const body = request.body as LoginBody;

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
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userJwt = request.user as UserPayload;
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
  fastify.put('/me', { preHandler: [fastify.authenticate, validate(updateMeSchema)] }, async (request, reply) => {
    const userJwt = request.user as UserPayload;
    const body = request.body as UpdateMeBody; 

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
  fastify.post('/me/addresses', { preHandler: [fastify.authenticate, validate(addressSchema)] }, async (request, reply) => {
    const userJwt = request.user as UserPayload;
    const body = request.body as AddressBody;

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

  // Forgot password
  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = request.body as { email: string };
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      await prisma.verificationToken.upsert({
        where: { userId_type: { userId: user.id, type: 'PASSWORD_RESET' } },
        update: { token, expiresAt },
        create: { userId: user.id, token, type: 'PASSWORD_RESET', expiresAt }
      });

      const { sendPasswordResetEmail } = await import('../services/email.service');
      await sendPasswordResetEmail(user.email, token);
    }

    return { message: 'If that email exists, we have sent a reset link.' };
  });

  // Reset password
  fastify.post('/reset-password', async (request, reply) => {
    const { token, password } = request.body as { token: string, password: string };

    const vt = await prisma.verificationToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!vt || vt.type !== 'PASSWORD_RESET' || vt.expiresAt < new Date()) {
      return reply.code(400).send({ message: 'Invalid or expired token' });
    }

    const hashedPassword = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: vt.userId },
        data: { passwordHash: hashedPassword }
      }),
      prisma.verificationToken.delete({ where: { id: vt.id } })
    ]);

    return { message: 'Password reset successful' };
  });
}
