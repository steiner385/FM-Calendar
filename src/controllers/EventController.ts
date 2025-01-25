import { PrismaClient } from '../prisma';
import { CalendarError } from '../errors/CalendarError';
import { Context } from 'hono';

export class EventController {
  constructor(private prisma: PrismaClient) {}

  /**
   * List all events
   */
  async listEvents(ctx: Context) {
    try {
      const events = await this.prisma.event.findMany({
        include: {
          calendar: true
        }
      });
      return ctx.json(events);
    } catch (error) {
      throw new CalendarError('Failed to list events', 'LIST_EVENTS_ERROR', 500, error);
    }
  }

  /**
   * Create a new event
   */
  async create(ctx: Context) {
    try {
      const data = await ctx.req.json();
      const event = await this.prisma.event.create({
        data,
        include: {
          calendar: true
        }
      });
      return ctx.json(event);
    } catch (error) {
      throw new CalendarError('Failed to create event', 'CREATE_EVENT_ERROR', 500, error);
    }
  }

  /**
   * Get event by ID
   */
  async getById(ctx: Context) {
    try {
      const id = ctx.req.param('id');
      const event = await this.prisma.event.findUnique({
        where: { id },
        include: {
          calendar: true
        }
      });

      if (!event) {
        throw new CalendarError('Event not found', 'EVENT_NOT_FOUND', 404);
      }

      return ctx.json(event);
    } catch (error) {
      if (error instanceof CalendarError) throw error;
      throw new CalendarError('Failed to get event', 'GET_EVENT_ERROR', 500, error);
    }
  }

  /**
   * Update an event
   */
  async update(ctx: Context) {
    try {
      const id = ctx.req.param('id');
      const data = await ctx.req.json();

      const event = await this.prisma.event.update({
        where: { id },
        data,
        include: {
          calendar: true
        }
      });

      return ctx.json(event);
    } catch (error) {
      throw new CalendarError('Failed to update event', 'UPDATE_EVENT_ERROR', 500, error);
    }
  }

  /**
   * Delete an event
   */
  async delete(ctx: Context) {
    try {
      const id = ctx.req.param('id');
      await this.prisma.event.delete({
        where: { id }
      });
      return ctx.json({ success: true });
    } catch (error) {
      throw new CalendarError('Failed to delete event', 'DELETE_EVENT_ERROR', 500, error);
    }
  }

  /**
   * List events by family
   */
  async listByFamily(ctx: Context) {
    try {
      const familyId = ctx.req.param('familyId');
      const events = await this.prisma.event.findMany({
        where: { familyId },
        include: {
          calendar: true
        }
      });
      return ctx.json(events);
    } catch (error) {
      throw new CalendarError('Failed to list family events', 'LIST_FAMILY_EVENTS_ERROR', 500, error);
    }
  }

  /**
   * Handle task deadline update
   */
  async handleTaskDeadlineUpdate(data: any) {
    try {
      const { taskId, deadline, familyId } = data;
      await this.prisma.event.upsert({
        where: {
          id: `task-${taskId}`
        },
        create: {
          id: `task-${taskId}`,
          title: `Task Deadline: ${data.title}`,
          startTime: new Date(deadline),
          endTime: new Date(deadline),
          familyId,
          createdBy: data.userId,
          userId: data.assignedToId,
          calendarId: data.calendarId
        },
        update: {
          startTime: new Date(deadline),
          endTime: new Date(deadline)
        }
      });
    } catch (error) {
      throw new CalendarError('Failed to handle task deadline update', 'TASK_DEADLINE_UPDATE_ERROR', 500, error);
    }
  }

  /**
   * Handle shopping schedule update
   */
  async handleShoppingScheduleUpdate(data: any) {
    try {
      const { scheduleId, date, familyId } = data;
      await this.prisma.event.upsert({
        where: {
          id: `shopping-${scheduleId}`
        },
        create: {
          id: `shopping-${scheduleId}`,
          title: `Shopping: ${data.title}`,
          startTime: new Date(date),
          endTime: new Date(date),
          familyId,
          createdBy: data.userId,
          userId: data.assignedToId,
          calendarId: data.calendarId
        },
        update: {
          startTime: new Date(date),
          endTime: new Date(date)
        }
      });
    } catch (error) {
      throw new CalendarError('Failed to handle shopping schedule update', 'SHOPPING_SCHEDULE_UPDATE_ERROR', 500, error);
    }
  }
}
