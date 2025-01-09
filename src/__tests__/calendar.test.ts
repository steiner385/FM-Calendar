import { setupCalendarTest, cleanupCalendarTest, type CalendarTestContext } from './calendar-test-setup';
import { CalendarType } from '../types';

describe('Calendar Service', () => {
  let context: CalendarTestContext;

  beforeEach(async () => {
    context = await setupCalendarTest();
  });

  afterEach(async () => {
    await cleanupCalendarTest();
  });

  describe('Calendar Creation', () => {
    it('should create a personal calendar', async () => {
      const calendar = await context.calendarService.createCalendar({
        name: 'Personal Calendar',
        type: CalendarType.LOCAL,
        ownerId: context.parentId,
        isDefault: true
      });

      expect(calendar).toBeDefined();
      expect(calendar.name).toBe('Personal Calendar');
      expect(calendar.type).toBe(CalendarType.LOCAL);
      expect(calendar.ownerId).toBe(context.parentId);
      expect(calendar.isDefault).toBe(true);

      // Check owner permissions were created
      const permission = await context.calendarService.getPermission(calendar.id, context.parentId);
      expect(permission).toBeDefined();
      expect(permission?.canView).toBe(true);
      expect(permission?.canEdit).toBe(true);
      expect(permission?.canShare).toBe(true);
    });

    it('should create a family calendar with permissions for all members', async () => {
      const calendar = await context.calendarService.createCalendar({
        name: 'Family Calendar',
        type: CalendarType.LOCAL,
        ownerId: context.parentId,
        familyId: context.familyId
      });

      expect(calendar).toBeDefined();
      expect(calendar.familyId).toBe(context.familyId);

      // Check owner permissions
      const ownerPermission = await context.calendarService.getPermission(calendar.id, context.parentId);
      expect(ownerPermission?.canView).toBe(true);
      expect(ownerPermission?.canEdit).toBe(true);
      expect(ownerPermission?.canShare).toBe(true);

      // Check member permissions
      const memberPermission = await context.calendarService.getPermission(calendar.id, context.memberId);
      expect(memberPermission?.canView).toBe(true);
      expect(memberPermission?.canEdit).toBe(true);
      expect(memberPermission?.canShare).toBe(false);
    });
  });

  describe('Calendar Retrieval', () => {
    let calendarId: string;

    beforeEach(async () => {
      const calendar = await context.calendarService.createCalendar({
        name: 'Test Calendar',
        type: CalendarType.LOCAL,
        ownerId: context.parentId
      });
      calendarId = calendar.id;
    });

    it('should get a calendar by id', async () => {
      const calendar = await context.calendarService.getCalendar(calendarId);
      expect(calendar).toBeDefined();
      expect(calendar?.id).toBe(calendarId);
    });

    it('should return null for non-existent calendar', async () => {
      const calendar = await context.calendarService.getCalendar('non-existent-id');
      expect(calendar).toBeNull();
    });

    it('should get user calendars', async () => {
      const calendars = await context.calendarService.getUserCalendars(context.parentId);
      expect(calendars).toHaveLength(1);
      expect(calendars[0].id).toBe(calendarId);
    });

    it('should get family calendars', async () => {
      await context.calendarService.createCalendar({
        name: 'Family Calendar',
        type: CalendarType.LOCAL,
        ownerId: context.parentId,
        familyId: context.familyId
      });

      const calendars = await context.calendarService.getFamilyCalendars(context.familyId);
      expect(calendars).toHaveLength(1);
      expect(calendars[0].familyId).toBe(context.familyId);
    });
  });

  describe('Calendar Updates', () => {
    let calendarId: string;

    beforeEach(async () => {
      const calendar = await context.calendarService.createCalendar({
        name: 'Test Calendar',
        type: CalendarType.LOCAL,
        ownerId: context.parentId
      });
      calendarId = calendar.id;
    });

    it('should update calendar details', async () => {
      const updated = await context.calendarService.updateCalendar(calendarId, {
        name: 'Updated Calendar',
        description: 'New description',
        color: '#FF0000'
      });

      expect(updated.name).toBe('Updated Calendar');
      expect(updated.description).toBe('New description');
      expect(updated.color).toBe('#FF0000');
    });

    it('should update external config', async () => {
      const externalConfig = {
        type: CalendarType.GOOGLE,
        googleCalendarId: 'test@group.calendar.google.com',
        accessToken: 'test-token'
      };

      const updated = await context.calendarService.updateCalendar(calendarId, {
        type: CalendarType.GOOGLE,
        externalConfig
      });

      expect(updated.type).toBe(CalendarType.GOOGLE);
      expect(updated.externalConfig).toEqual(externalConfig);
    });
  });

  describe('Calendar Deletion', () => {
    it('should delete calendar and all related data', async () => {
      const calendar = await context.calendarService.createCalendar({
        name: 'Test Calendar',
        type: CalendarType.LOCAL,
        ownerId: context.parentId
      });

      await context.calendarService.deleteCalendar(calendar.id);

      const deleted = await context.calendarService.getCalendar(calendar.id);
      expect(deleted).toBeNull();

      const permission = await context.calendarService.getPermission(calendar.id, context.parentId);
      expect(permission).toBeNull();
    });
  });

  describe('Permission Management', () => {
    let calendarId: string;

    beforeEach(async () => {
      const calendar = await context.calendarService.createCalendar({
        name: 'Test Calendar',
        type: CalendarType.LOCAL,
        ownerId: context.parentId
      });
      calendarId = calendar.id;
    });

    it('should add user to calendar with specified permissions', async () => {
      const permission = await context.calendarService.addUserToCalendar(calendarId, context.memberId, {
        canView: true,
        canEdit: true,
        canShare: false
      });

      expect(permission.userId).toBe(context.memberId);
      expect(permission.canView).toBe(true);
      expect(permission.canEdit).toBe(true);
      expect(permission.canShare).toBe(false);
    });

    it('should update user permissions', async () => {
      await context.calendarService.addUserToCalendar(calendarId, context.memberId, {
        canView: true,
        canEdit: false
      });

      const updated = await context.calendarService.updatePermission(calendarId, context.memberId, {
        canEdit: true
      });

      expect(updated.canEdit).toBe(true);
    });

    it('should remove user from calendar', async () => {
      await context.calendarService.addUserToCalendar(calendarId, context.memberId, {
        canView: true
      });

      await context.calendarService.removeUserFromCalendar(calendarId, context.memberId);

      const permission = await context.calendarService.getPermission(calendarId, context.memberId);
      expect(permission).toBeNull();
    });

    it('should check user permissions correctly', async () => {
      await context.calendarService.addUserToCalendar(calendarId, context.memberId, {
        canView: true,
        canEdit: false,
        canShare: false
      });

      const canView = await context.calendarService.checkPermission(calendarId, context.memberId, { canView: true });
      expect(canView).toBe(true);

      const canEdit = await context.calendarService.checkPermission(calendarId, context.memberId, { canEdit: true });
      expect(canEdit).toBe(false);
    });
  });
});
