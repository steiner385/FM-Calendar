import type { Event } from '@prisma/client';
import { logger } from '../../../utils/logger';

export class CalendarEventCacheService {
  private static instance: CalendarEventCacheService;
  private cache: Map<string, Event[]>;
  private cacheExpiry: Map<string, number>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
  }

  public static getInstance(): CalendarEventCacheService {
    if (!CalendarEventCacheService.instance) {
      CalendarEventCacheService.instance = new CalendarEventCacheService();
    }
    return CalendarEventCacheService.instance;
  }

  public set(key: string, events: Event[], ttl: number = this.DEFAULT_TTL): void {
    try {
      this.cache.set(key, events);
      this.cacheExpiry.set(key, Date.now() + ttl);
      
      // Schedule cleanup
      setTimeout(() => this.invalidate(key), ttl);
      
      logger.debug(`Cached ${events.length} events for key: ${key}`);
    } catch (error) {
      logger.error('Failed to cache events:', error);
    }
  }

  public get(key: string): Event[] | null {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      this.invalidate(key);
      return null;
    }
    
    return this.cache.get(key) || null;
  }

  public invalidate(key: string): void {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
    logger.debug(`Invalidated cache for key: ${key}`);
  }

  public clear(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
    logger.debug('Cleared entire event cache');
  }

  public getCacheKey(params: Record<string, any>): string {
    return Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
      .join('|');
  }
}
