import type { PrismaClient } from '@prisma/client';

export type { PrismaClient };

export interface PluginConfig {
  metadata: {
    name: string;
    version: string;
    description: string;
    author: string;
    license: string;
  };
  config: unknown;
  events: {
    subscriptions: string[];
    publications: string[];
  };
}

export interface PluginContext {
  logger: {
    info: (message: string, ...args: any[]) => void;
    error: (message: string, error: Error) => void;
    warn: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
  };
}

export interface PluginHealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  message: string;
  metrics?: {
    totalEvents: number;
    upcomingEvents: number;
    calendarsCount: number;
  };
  error?: unknown;
}

export interface RouteDefinition {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  handler: (ctx: any) => Promise<any>;
  description: string;
}

export interface CalendarEventData {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  familyId: string;
  createdBy: string;
  userId: string;
  calendarId: string;
}
