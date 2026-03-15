import { FastifyInstance } from 'fastify';
import { searchProducts } from '@modcart/search';

export default async function searchRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const { q, category, minPrice, maxPrice } = request.query as any;
    
    try {
      const results = await searchProducts(q || '', {
        category,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      });
      return results;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ message: 'Search failed' });
    }
  });
}
