import { env } from '@modcart/config';
import * as Sentry from '@sentry/node';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import chatRoutes from './routes/chat';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import categoryRoutes from './routes/categories';
import productRoutes from './routes/products';
import searchRoutes from './routes/search';
import vendorRoutes from './routes/vendor';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import payoutRoutes from './routes/payouts';
import reviewRoutes from './routes/reviews';
import adminRoutes from './routes/admin';
import notificationRoutes from './routes/notifications';
import recommendationRoutes from './routes/recommendations';
import wishlistRoutes from './routes/wishlist';
import promotionRoutes from './routes/promotions';
import qaRoutes from './routes/qa';
import shippingRoutes from './routes/shipping';
import { initIndex } from '@modcart/search';
import storagePlugin from './plugins/storage';

const server = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
    },
  },
});

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 1.0,
  });

  server.setErrorHandler((error, request, reply) => {
    Sentry.withScope((scope) => {
      scope.setTag('path', request.url);
      scope.setUser({ id: (request.user as any)?.id });
      Sentry.captureException(error);
    });
    console.error(error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  });
}

const start = async () => {
  try {
    // Basic plugins
    await server.register(cors);
    await server.register(helmet);
    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute'
    });
    await server.register(websocket);
    
    // Auth setup
    await server.register(jwt, {
      secret: env.JWT_ACCESS_SECRET,
    });
    await server.register(authPlugin);
    await server.register(storagePlugin);

    // Routes
    await server.register(authRoutes, { prefix: '/api/v1/auth' });
    await server.register(categoryRoutes, { prefix: '/api/v1/categories' });
    await server.register(productRoutes, { prefix: '/api/v1/products' });
    await server.register(searchRoutes, { prefix: '/api/v1/search' });
    await server.register(cartRoutes, { prefix: '/api/v1/cart' });
    await server.register(orderRoutes, { prefix: '/api/v1/orders' });
    await server.register(paymentRoutes, { prefix: '/api/v1/payments' });
    await server.register(payoutRoutes, { prefix: '/api/v1/payouts' });
    await server.register(reviewRoutes, { prefix: '/api/v1/reviews' });
    await server.register(adminRoutes, { prefix: '/api/v1/admin' });
    await server.register(vendorRoutes, { prefix: '/api/v1/vendor' });
    await server.register(notificationRoutes, { prefix: '/api/v1/notifications' });
    await server.register(chatRoutes, { prefix: '/api/v1/chat' });
    await server.register(recommendationRoutes, { prefix: '/api/v1/recommendations' });
    await server.register(wishlistRoutes, { prefix: '/api/v1/wishlist' });
    await server.register(promotionRoutes, { prefix: '/api/v1/promotions' });
    await server.register(qaRoutes, { prefix: '/api/v1/qa' });
    await server.register(shippingRoutes, { prefix: '/api/v1/shipping' });

    // Initialize Search Index
    initIndex().catch((err: Error) => server.log.error(err, 'Search index initialization failed'));

    server.get('/health', async () => {
      return { status: 'ok' };
    });

    const port = env.PORT;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
