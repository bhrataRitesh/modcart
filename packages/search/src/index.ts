import { Client } from '@elastic/elasticsearch';

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
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
  imageUrls?: string[];
  isVerified?: boolean;
}

export interface SearchFilter {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

export const initIndex = async () => {
  const exists = await client.indices.exists({ index: INDEX_NAME });
  if (exists) {
    // Optionally update settings or mappings here if needed
    return;
  }

  await client.indices.create({
    index: INDEX_NAME,
    body: {
      settings: {
        analysis: {
          filter: {
            autocomplete_filter: {
              type: 'edge_ngram',
              min_gram: 2,
              max_gram: 20,
            },
          },
          analyzer: {
            autocomplete: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'autocomplete_filter'],
            },
            autocomplete_search: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase'],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          name: { 
            type: 'text', 
            analyzer: 'standard',
            fields: {
              suggest: {
                type: 'text',
                analyzer: 'autocomplete',
                search_analyzer: 'autocomplete_search',
              },
              keyword: { type: 'keyword' }
            }
          },
          description: { type: 'text' },
          price: { type: 'float' },
          vendorId: { type: 'keyword' },
          vendorName: { 
            type: 'text',
            fields: { keyword: { type: 'keyword' } }
          },
          categories: { type: 'keyword' },
          imageUrl: { type: 'keyword' },
          imageUrls: { type: 'keyword' },
          isVerified: { type: 'boolean' },
          rating: { type: 'float' },
          reviewsCount: { type: 'integer' },
          inStock: { type: 'boolean' }
        },
      },
    },
  });
};

export interface SearchFilter {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  vendorId?: string;
  inStock?: boolean;
}

export type SearchSort = 'price_asc' | 'price_desc' | 'newest' | 'relevance';

export const indexProduct = async (product: SearchProduct) => {
  await client.index({
    index: INDEX_NAME,
    id: product.id,
    body: product,
    refresh: true,
  });
};

export interface SearchResponse {
  items: SearchProduct[];
  total: number;
  facets: any;
}

export const searchProducts = async (
  query: string, 
  filters: SearchFilter = {}, 
  sort: SearchSort = 'relevance',
  page: number = 1,
  limit: number = 20
): Promise<SearchResponse> => {
  const must: any[] = query ? [
    {
      multi_match: {
        query,
        fields: ['name^5', 'name.suggest^2', 'description', 'vendorName^3'],
        fuzziness: 'AUTO',
        prefix_length: 2
      },
    }
  ] : [{ match_all: {} }];

  const filter: any[] = [];

  if (filters.category) filter.push({ term: { categories: filters.category } });
  if (filters.vendorId) filter.push({ term: { vendorId: filters.vendorId } });
  if (filters.inStock !== undefined) filter.push({ term: { inStock: filters.inStock } });

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const range: any = { price: {} };
    if (filters.minPrice !== undefined) range.price.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) range.price.lte = filters.maxPrice;
    filter.push({ range });
  }

  const sortConfigs: any = {
    price_asc: [{ price: 'asc' }],
    price_desc: [{ price: 'desc' }],
    newest: [{ id: 'desc' }], // Assuming ID correlates with time or add createdAt
    relevance: ['_score']
  };

  const result = await client.search({
    index: INDEX_NAME,
    body: {
      from: (page - 1) * limit,
      size: limit,
      query: {
        bool: { must, filter },
      },
      sort: sortConfigs[sort] || sortConfigs.relevance,
      aggs: {
        categories: { terms: { field: 'categories', size: 20 } },
        vendors: { terms: { field: 'vendorName.keyword', size: 20 } },
        price_ranges: {
          range: {
            field: 'price',
            ranges: [
              { to: 50 },
              { from: 50, to: 100 },
              { from: 100, to: 500 },
              { from: 500 }
            ]
          }
        }
      }
    },
  });

  return {
    items: result.hits.hits.map((hit: any) => hit._source),
    total: (result.hits.total as any).value,
    facets: result.aggregations
  };
};

export const autocomplete = async (query: string) => {
  if (!query) return [];

  const result = await client.search({
    index: INDEX_NAME,
    body: {
      size: 5,
      query: {
        match: {
          'name.suggest': {
            query,
            analyzer: 'autocomplete_search'
          }
        }
      },
      _source: ['id', 'name', 'imageUrl', 'price']
    }
  });

  return result.hits.hits.map((hit: any) => hit._source);
};

export { client };
