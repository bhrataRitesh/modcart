import { prisma } from '@modcart/db';
import { FastifyRequest } from 'fastify';

export async function logAudit(params: {
  request?: FastifyRequest;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
}) {
  const { request, userId, action, resource, resourceId, details } = params;

  let finalUserId = userId;
  if (!finalUserId && request?.user) {
    finalUserId = (request.user as any).id;
  }

  await prisma.auditLog.create({
    data: {
      userId: finalUserId,
      action,
      resource,
      resourceId,
      details: details ? JSON.stringify(details) : undefined,
      ip: request?.ip,
      userAgent: request?.headers['user-agent']
    }
  }).catch(err => console.error('Failed to log audit:', err));
}
