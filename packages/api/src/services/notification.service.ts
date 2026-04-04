import { prisma } from '@modcart/db';
import { activeUserSockets } from '../routes/notifications';

export async function sendNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  const { userId, type, title, message, link } = params;

  // 1. Create in Database
  const notification = await prisma.notification.create({
    data: { userId, type, title, message, link }
  });

  // 2. Deliver via WebSocket
  const sockets = activeUserSockets.get(userId);
  if (sockets && sockets.size > 0) {
    const payload = JSON.stringify({ type: 'NOTIFICATION', notification });
    sockets.forEach(socket => {
      try {
        socket.send(payload);
      } catch (err) {
        console.error('Failed to send WS notification:', err);
      }
    });
  }

  // 3. Optional: Add Email logic here in the future
  return notification;
}
