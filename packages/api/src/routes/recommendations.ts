import { FastifyInstance } from 'fastify';
import { 
  getSimilarProducts, 
  getAlsoBought, 
  getTrendingProducts, 
  getRecentlyViewed 
} from '../services/recommendation.service';

export default async function recommendationRoutes(fastify: FastifyInstance) {
  fastify.get('/trending', async () => {
    return getTrendingProducts();
  });

  fastify.get('/recently-viewed', async (request) => {
    const visitorId = (request.query as any).visitorId;
    if (!visitorId) return [];
    return getRecentlyViewed(visitorId);
  });

  fastify.get('/similar/:productId', async (request) => {
    const { productId } = request.params as { productId: string };
    return getSimilarProducts(productId);
  });

  fastify.get('/also-bought/:productId', async (request) => {
    const { productId } = request.params as { productId: string };
    return getAlsoBought(productId);
  });
}
