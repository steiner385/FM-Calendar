import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Context } from 'hono';
import { EventController } from './controllers/EventController';
import { RouteDefinition } from './types';

/**
 * Plugin configuration schema
 */
const configSchema = z.object({
  maxEventsPerCalendar: z.number().min(1).default(1000),
  defaultCalendarId: z.string().uuid().optional(),
  syncInterval: z.number().min(60).default(300), // 5 minutes
  notifyOnEventCreation: z.boolean().default(true),
  notifyOnEventUpdate: z.boolean().default(true)
});

type CalendarPluginConfig = z.infer<typeof configSchema>;

/**
 * Calendar plugin that provides calendar management capabilities
 */
export class CalendarPlugin {
  private prisma: PrismaClient;
  private metricsInterval?: NodeJS.Timeout;
  private metrics = {
    totalEvents: 0,
    upcomingEvents: 0,
    calendarsCount: 0
  };

  private eventController: EventController;

  constructor() {
    this.prisma = new PrismaClient();
    this.eventController = new EventController(this.prisma);
  }

  /**
   * Initialize plugin
   */
  async init(): Promise<void> {
    await this.updateMetrics();
  }

  /**
   * Start plugin
   */
  async start(): Promise<void> {
    this.metricsInterval = setInterval(() => this.updateMetrics(), 60000);
  }

  /**
   * Stop plugin
   */
  async stop(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    await this.prisma.$disconnect();
  }

  /**
   * Get routes for the plugin
   */
  getRoutes(): RouteDefinition[] {
    return [
      {
        path: '/api/calendar/events',
        method: 'GET',
        handler: this.eventController.listEvents.bind(this.eventController),
        description: 'List all events'
      },
      {
        path: '/api/calendar/events',
        method: 'POST',
        handler: this.eventController.create.bind(this.eventController),
        description: 'Create a new event'
      },
      {
        path: '/api/calendar/events/:id',
        method: 'GET',
        handler: this.eventController.getById.bind(this.eventController),
        description: 'Get event by ID'
      },
      {
        path: '/api/calendar/events/:id',
        method: 'PUT',
        handler: this.eventController.update.bind(this.eventController),
        description: 'Update an event'
      },
      {
        path: '/api/calendar/events/:id',
        method: 'DELETE',
        handler: this.eventController.delete.bind(this.eventController),
        description: 'Delete an event'
      },
      {
        path: '/api/calendar/events/family/:familyId',
        method: 'GET',
        handler: this.eventController.listByFamily.bind(this.eventController),
        description: 'List events by family'
      }
    ];
  }

  /**
   * Update metrics
   */
  private async updateMetrics(): Promise<void> {
    try {
      const [total, upcoming, calendars] = await Promise.all([
        this.prisma.event.count(),
        this.prisma.event.count({
          where: {
            startTime: { gt: new Date() }
          }
        }),
        this.prisma.calendar.count()
      ]);

      this.metrics = {
        totalEvents: total,
        upcomingEvents: upcoming,
        calendarsCount: calendars
      };
    } catch (error) {
      console.error('Error updating metrics:', error);
    }
  }

  /**
   * Get plugin health status
   */
  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'healthy',
        timestamp: Date.now(),
        message: 'Plugin is healthy',
        metrics: this.metrics
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        error,
        message: 'Database connection failed'
      };
    }
  }
}
