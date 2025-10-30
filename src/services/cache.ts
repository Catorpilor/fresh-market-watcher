// Simple in-memory cache with TTL support
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class Cache {
  private store = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 60 * 1000; // 60 seconds in milliseconds

  set<T>(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttlMs || this.DEFAULT_TTL,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Entry has expired
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.store.delete(key);
      }
    }
  }

  // Generate cache key for pair queries
  static generateKey(
    chain: string,
    factories: string[],
    fromBlock: number,
    toBlock: number
  ): string {
    return `pairs:${chain}:${factories.sort().join(",")}:${fromBlock}:${toBlock}`;
  }
}

// Global cache instance
export const cache = new Cache();

// Cleanup expired entries every 30 seconds
setInterval(() => {
  cache.cleanup();
}, 30 * 1000);