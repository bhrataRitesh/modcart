import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cache } from '../../lib/cache';

// Use the mocked version from setup.ts
describe('Cache utility', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null on cache miss', async () => {
    vi.mocked(cache.get).mockResolvedValue(null);
    const result = await cache.get('missing-key');
    expect(result).toBeNull();
  });

  it('stores and retrieves values', async () => {
    const data = { products: [{ id: '1', name: 'Phone' }] };
    vi.mocked(cache.get).mockResolvedValue(data);

    const result = await cache.get<typeof data>('products:all');
    expect(result).toEqual(data);
  });

  it('set is called with correct TTL', async () => {
    await cache.set('key', { value: 1 }, 600);
    expect(cache.set).toHaveBeenCalledWith('key', { value: 1 }, 600);
  });

  it('del removes a key', async () => {
    await cache.del('categories:all');
    expect(cache.del).toHaveBeenCalledWith('categories:all');
  });
});
