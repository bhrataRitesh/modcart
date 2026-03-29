import './env';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
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
import { initIndex } from '@modcart/search';
import storagePlugin from './plugins/storage';

const server = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
    },
  },
});

const start = async () => {
  try {
    // Basic plugins
    await server.register(cors);
    await server.register(helmet);
    await server.register(websocket);
    
    // Auth setup
    await server.register(jwt, {
      secret: process.env.JWT_ACCESS_SECRET || 'super-secret',
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
    await server.register(chatRoutes, { prefix: '/api/v1/chat' });

    // Initialize Search Index
    initIndex().catch((err: Error) => server.log.error(err, 'Search index initialization failed'));

    server.get('/health', async () => {
      return { status: 'ok' };
    });

    const port = Number(process.env.PORT) || 3001;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
