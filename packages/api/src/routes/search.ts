import { FastifyInstance } from 'fastify';
import { searchProducts, autocomplete, SearchSort } from '@modcart/search';

interface SearchQuery {
  q?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  vendorId?: string;
  inStock?: string;
  sort?: SearchSort;
  page?: string;
  limit?: string;
}

export default async function searchRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const { 
      q, category, minPrice, maxPrice, vendorId, inStock, sort, page, limit 
    } = request.query as SearchQuery;
    
    try {
      const results = await searchProducts(
        q || '', 
        {
          category,
          vendorId,
          inStock: inStock === 'true' ? true : inStock === 'false' ? false : undefined,
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        },
        sort,
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 20
      );
      return results;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ message: 'Search failed' });
    }
  });

  fastify.get('/autocomplete', async (request, reply) => {
    const { q } = request.query as { q?: string };
    try {
      const suggestions = await autocomplete(q || '');
      return suggestions;
    } catch (error) {
      fastify.log.error(error);
      return [];
    }
  });
}
