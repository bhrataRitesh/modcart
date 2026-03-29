import { Client } from '@elastic/elasticsearch';

const client = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
});

const INDEX_NAME = 'products';

export interface SearchProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  vendorId: string;
  vendorName: string;
  categories: string[];
  imageUrl?: string | null;
  isVerified?: boolean;
}

export interface SearchFilter {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

export const initIndex = async () => {
  const exists = await client.indices.exists({ index: INDEX_NAME });
  if (!exists) {
    await client.indices.create({
      index: INDEX_NAME,
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text', analyzer: 'standard' },
            description: { type: 'text' },
            price: { type: 'float' },
            vendorId: { type: 'keyword' },
            vendorName: { type: 'text' },
            categories: { type: 'keyword' },
            imageUrl: { type: 'keyword' },
            isVerified: { type: 'boolean' },
          },
        },
      },
    });
  }
};

export const indexProduct = async (product: SearchProduct) => {
  await client.index({
    index: INDEX_NAME,
    id: product.id,
    body: product,
    refresh: true,
  });
};

export const searchProducts = async (query: string, filters: SearchFilter = {}) => {
  const must: any[] = query ? [
    {
      multi_match: {
        query,
        fields: ['name^3', 'description', 'vendorName'],
      },
    }
  ] : [{ match_all: {} }];

  const filter: any[] = [];

  if (filters.category) {
    filter.push({ term: { categories: filters.category } });
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const range: any = { price: {} };
    if (filters.minPrice !== undefined) range.price.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) range.price.lte = filters.maxPrice;
    filter.push({ range });
  }

  const result = await client.search({
    index: INDEX_NAME,
    body: {
      query: {
        bool: {
          must,
          filter,
        },
      },
    },
  });

  return result.hits.hits.map((hit: any) => hit._source);
};

export { client };
