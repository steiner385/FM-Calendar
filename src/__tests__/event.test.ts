import { setupCalendarTest, cleanupCalendarTest, type CalendarTestContext } from './calendar-test-setup';
import { CalendarType, EventStatus, RecurrenceType } from '../types';
import { addDays } from 'date-fns';

describe('Event Service', () => {
  let context: CalendarTestContext;
  let calendarId: string;

  beforeEach(async () => {
    context = await setupCalendarTest();
    const calendar = await context.calendarService.createCalendar({
      name: 'Test Calendar',
      type: CalendarType.LOCAL,
      ownerId: context.parentId
    });
    calendarId = calendar.id;
  });

  afterEach(async () => {
    await cleanupCalendarTest();
  });

  describe('Event Creation', () => {
    it('should create a single event', async () => {
      const startTime = new Date();
      const endTime = addDays(startTime, 1);

      const event = await context.eventService.createEvent({
        calendarId,
        title: 'Test Event',
        description: 'Test Description',
        location: 'Test Location',
        startTime,
        endTime,
        createdBy: context.parentId
      });

      expect(event).toBeDefined();
      expect(event.title).toBe('Test Event');
      expect(event.description).toBe('Test Description');
      expect(event.location).toBe('Test Location');
      expect(event.startTime).toEqual(startTime);
      expect(event.endTime).toEqual(endTime);
      expect(event.status).toBe(EventStatus.CONFIRMED);
    });

    it('should create a recurring event', async () => {
      const startTime = new Date();
      const endTime = addDays(startTime, 1);

      const event = await context.eventService.createEvent({
        calendarId,
        title: 'Recurring Event',
        startTime,
        endTime,
        createdBy: context.parentId,
        recurrence: {
          type: RecurrenceType.WEEKLY,
          interval: 1,
          count: 4
        }
      });

      expect(event.recurrence).toBeDefined();
      expect(event.recurrence?.type).toBe(RecurrenceType.WEEKLY);
      expect(event.recurrence?.interval).toBe(1);
      expect(event.recurrence?.count).toBe(4);
    });

    it('should fail to create event without edit permission', async () => {
      // Add member with view-only permission
      await context.calendarService.addUserToCalendar(calendarId, context.memberId, {
        canView: true,
        canEdit: false
      });

      await expect(context.eventService.createEvent({
        calendarId,
        title: 'Test Event',
        startTime: new Date(),
        endTime: addDays(new Date(), 1),
        createdBy: context.memberId
      })).rejects.toThrow('User does not have permission');
    });
  });

  describe('Event Retrieval', () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await context.eventService.createEvent({
        calendarId,
        title: 'Test Event',
        startTime: new Date(),
        endTime: addDays(new Date(), 1),
        createdBy: context.parentId
      });
      eventId = event.id;
    });

    it('should get event by id', async () => {
      const event = await context.eventService.getEvent(eventId, context.parentId);
      expect(event).toBeDefined();
      expect(event?.id).toBe(eventId);
    });

    it('should fail to get event without view permission', async () => {
      await expect(context.eventService.getEvent(
        eventId,
        'non-authorized-user'
      )).rejects.toThrow('User does not have permission');
    });

    it('should get all calendar events', async () => {
      const events = await context.eventService.getCalendarEvents(calendarId, context.parentId);
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe(eventId);
    });
  });

  describe('Event Updates', () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await context.eventService.createEvent({
        calendarId,
        title: 'Test Event',
        startTime: new Date(),
        endTime: addDays(new Date(), 1),
        createdBy: context.parentId
      });
      eventId = event.id;
    });

    it('should update event details', async () => {
      const updated = await context.eventService.updateEvent(eventId, {
        title: 'Updated Event',
        description: 'Updated Description',
        status: EventStatus.TENTATIVE
      }, context.parentId);

      expect(updated.title).toBe('Updated Event');
      expect(updated.description).toBe('Updated Description');
      expect(updated.status).toBe(EventStatus.TENTATIVE);
    });

    it('should fail to update event without edit permission', async () => {
      // Add member with view-only permission
      await context.calendarService.addUserToCalendar(calendarId, context.memberId, {
        canView: true,
        canEdit: false
      });

      await expect(context.eventService.updateEvent(
        eventId,
        { title: 'Updated Event' },
        context.memberId
      )).rejects.toThrow('User does not have permission');
    });
  });

  describe('Event Deletion', () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await context.eventService.createEvent({
        calendarId,
        title: 'Test Event',
        startTime: new Date(),
        endTime: addDays(new Date(), 1),
        createdBy: context.parentId
      });
      eventId = event.id;
    });

    it('should delete event', async () => {
      await context.eventService.deleteEvent(eventId, context.parentId);
      const deleted = await context.eventService.getEvent(eventId, context.parentId);
      expect(deleted).toBeNull();
    });

    it('should fail to delete event without edit permission', async () => {
      // Add member with view-only permission
      await context.calendarService.addUserToCalendar(calendarId, context.memberId, {
        canView: true,
        canEdit: false
      });

      await expect(context.eventService.deleteEvent(
        eventId,
        context.memberId
      )).rejects.toThrow('User does not have permission');
    });
  });

  describe('Recurring Events', () => {
    it('should expand daily recurring events', async () => {
      const startTime = new Date();
      const event = await context.eventService.createEvent({
        calendarId,
        title: 'Daily Event',
        startTime,
        endTime: addDays(startTime, 1),
        createdBy: context.parentId,
        recurrence: {
          type: RecurrenceType.DAILY,
          interval: 1,
          count: 3
        }
      });

      const expanded = await context.eventService.expandRecurringEvent(
        event,
        startTime,
        addDays(startTime, 5)
      );

      expect(expanded).toHaveLength(3);
      expanded.forEach((e, i) => {
        expect(e.startTime).toEqual(addDays(startTime, i));
        expect(e.title).toBe('Daily Event');
      });
    });

    it('should expand weekly recurring events', async () => {
      const startTime = new Date();
      const event = await context.eventService.createEvent({
        calendarId,
        title: 'Weekly Event',
        startTime,
        endTime: addDays(startTime, 1),
        createdBy: context.parentId,
        recurrence: {
          type: RecurrenceType.WEEKLY,
          interval: 1,
          count: 4
        }
      });

      const expanded = await context.eventService.expandRecurringEvent(
        event,
        startTime,
        addDays(startTime, 30)
      );

      expect(expanded).toHaveLength(4);
    });

    it('should handle recurrence exceptions', async () => {
      const startTime = new Date();
      const exceptionDate = addDays(startTime, 1);
      
      const event = await context.eventService.createEvent({
        calendarId,
        title: 'Event with Exception',
        startTime,
        endTime: addDays(startTime, 1),
        createdBy: context.parentId,
        recurrence: {
          type: RecurrenceType.DAILY,
          interval: 1,
          count: 3,
          exceptionDates: [exceptionDate]
        }
      });

      const expanded = await context.eventService.expandRecurringEvent(
        event,
        startTime,
        addDays(startTime, 5)
      );

      expect(expanded).toHaveLength(2);
      expect(expanded.some(e => e.startTime.getTime() === exceptionDate.getTime())).toBe(false);
    });
  });
});
