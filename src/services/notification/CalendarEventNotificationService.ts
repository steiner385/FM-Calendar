import type { Event } from '@prisma/client';
import { EventBus } from '../../../core/events/EventBus';
import { logger } from '../../../utils/logger';

export enum NotificationType {
  EVENT_REMINDER = 'EVENT_REMINDER',
  EVENT_UPDATE = 'EVENT_UPDATE',
  EVENT_CANCELLATION = 'EVENT_CANCELLATION'
}

export interface EventNotification {
  type: NotificationType;
  event: Event;
  message: string;
  timestamp: Date;
}

export class CalendarEventNotificationService {
  private static instance: CalendarEventNotificationService;
  private eventBus: EventBus;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.setupEventListeners();
  }

  public static getInstance(): CalendarEventNotificationService {
    if (!CalendarEventNotificationService.instance) {
      CalendarEventNotificationService.instance = new CalendarEventNotificationService();
    }
    return CalendarEventNotificationService.instance;
  }

  private setupEventListeners(): void {
    this.eventBus.subscribe('calendar.event.created', this.handleEventCreated.bind(this));
    this.eventBus.subscribe('calendar.event.updated', this.handleEventUpdated.bind(this));
    this.eventBus.subscribe('calendar.event.deleted', this.handleEventDeleted.bind(this));
  }

  private handleEventCreated(event: Event): void {
    this.sendNotification({
      type: NotificationType.EVENT_UPDATE,
      event,
      message: `New event created: ${event.title}`,
      timestamp: new Date()
    });
  }

  private handleEventUpdated(event: Event): void {
    this.sendNotification({
      type: NotificationType.EVENT_UPDATE,
      event,
      message: `Event updated: ${event.title}`,
      timestamp: new Date()
    });
  }

  private handleEventDeleted(event: Event): void {
    this.sendNotification({
      type: NotificationType.EVENT_CANCELLATION,
      event,
      message: `Event cancelled: ${event.title}`,
      timestamp: new Date()
    });
  }

  private sendNotification(notification: EventNotification): void {
    try {
      this.eventBus.emit('calendar.notification', notification);
      logger.info('Calendar notification sent', { notification });
    } catch (error) {
      logger.error('Failed to send calendar notification:', error);
    }
  }

  public scheduleReminder(event: Event, reminderTime: Date): void {
    const now = new Date();
    const delay = reminderTime.getTime() - now.getTime();

    if (delay <= 0) return;

    setTimeout(() => {
      this.sendNotification({
        type: NotificationType.EVENT_REMINDER,
        event,
        message: `Reminder: ${event.title} starts at ${event.startTime.toLocaleString()}`,
        timestamp: new Date()
      });
    }, delay);
  }
}
