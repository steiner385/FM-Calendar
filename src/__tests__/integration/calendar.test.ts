import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import { generateFutureDate } from '../utils/test-utils';
import { createTestApp, setupTestContext, createOtherFamilyContext, cleanupTestData, makeTestRequest, assertSuccessResponse, assertErrorResponse, getPrisma } from '../utils/setup';
import { Calendar } from '@prisma/client';

describe('Calendar Module Integration Tests', () => {
  const prisma = getPrisma();
  let app: any;
  let ctx: any;
  let calendar: Calendar;

  beforeAll(async () => {
    // Create test app with auth middleware
    app = createTestApp({ enableAuth: true });

    // Create test context with validation
    ctx = await setupTestContext();
    if (!ctx.family?.id) {
      throw new Error('Test context missing required family ID');
    }

    // Create a test calendar
    calendar = await prisma.calendar.create({
      data: {
        name: 'Test Calendar',
        type: 'GOOGLE',
        familyId: ctx.family.id,
        timezone: 'UTC'
      }
    });
  });

  afterEach(async () => {
    // Clean up test data but preserve family and user context
    await cleanupTestData(true);
  });

  afterAll(async () => {
    try {
      // Full cleanup including family and user data
      await cleanupTestData();
      await prisma.$disconnect();
    } catch (error) {
      console.error('Test cleanup failed:', error);
      throw error;
    }
  });

  describe('Event Management', () => {
    let testCalendar: Calendar;

    beforeEach(async () => {
      // Create test calendar and verify it exists
      testCalendar = await prisma.calendar.create({
        data: {
          name: 'Test Calendar',
          type: 'GOOGLE',
          familyId: ctx.family.id,
          timezone: 'UTC'
        }
      });

      const verifyCalendar = await prisma.calendar.findUnique({
        where: { id: testCalendar.id }
      });
      
      if (!verifyCalendar) {
        throw new Error('Failed to create test calendar');
      }
    });

    describe('POST /events', () => {
      it('should create an event', async () => {
        const response = await makeTestRequest(app, {
          method: 'POST',
          path: '/api/calendar/events',
          token: ctx.token,
          body: {
            title: 'Test Event',
            description: 'Test Description',
            startTime: new Date('2024-01-01T10:00:00Z'),
            endTime: new Date('2024-01-01T11:00:00Z'),
            familyId: ctx.family.id,
            calendarId: testCalendar.id  // Include required calendarId
          }
        });

        const data = await assertSuccessResponse(response, 201);
        expect(data).toMatchObject({
          title: 'Test Event',
          description: 'Test Description',
          familyId: ctx.family.id,
          calendarId: testCalendar.id
        });
      });

      it('should validate required fields', async () => {
        const response = await makeTestRequest(app, {
          method: 'POST',
          path: '/api/calendar/events',
          token: ctx.token,
          body: {
            // Only provide familyId but miss other required fields
            familyId: ctx.family.id
          }
        });

        const error = await assertErrorResponse(response, 400, 'VALIDATION_ERROR');
        expect(error.message).toContain('Required');
        expect(error.details).toBeDefined();
        // Verify specific required fields are mentioned in validation details
        const errorDetails = error.details;
        expect(errorDetails).toEqual([
          {
            code: 'invalid_type',
            expected: 'string',
            message: 'Required',
            path: ['title'],
            received: 'undefined'
          },
          {
            code: 'invalid_union',
            message: 'Invalid input',
            path: ['startTime'],
            unionErrors: [
              {
                issues: [{
                  code: 'invalid_type',
                  expected: 'string',
                  message: 'Required',
                  path: ['startTime'],
                  received: 'undefined'
                }],
                name: 'ZodError'
              },
              {
                issues: [{
                  code: 'invalid_type',
                  expected: 'date',
                  message: 'Required',
                  path: ['startTime'],
                  received: 'undefined'
                }],
                name: 'ZodError'
              }
            ]
          },
          {
            code: 'invalid_union',
            message: 'Invalid input',
            path: ['endTime'],
            unionErrors: [
              {
                issues: [{
                  code: 'invalid_type',
                  expected: 'string',
                  message: 'Required',
                  path: ['endTime'],
                  received: 'undefined'
                }],
                name: 'ZodError'
              },
              {
                issues: [{
                  code: 'invalid_type',
                  expected: 'date',
                  message: 'Required',
                  path: ['endTime'],
                  received: 'undefined'
                }],
                name: 'ZodError'
              }
            ]
          },
          {
            code: 'invalid_type',
            expected: 'string',
            message: 'Required',
            path: ['calendarId'],
            received: 'undefined'
          }
        ]);
      });

      it('should require authentication', async () => {
        const response = await makeTestRequest(app, {
          method: 'POST',
          path: '/api/calendar/events',
          body: {
            title: 'Test Event',
            startTime: new Date(),
            endTime: new Date(),
            familyId: ctx.family.id,
            calendarId: testCalendar.id
          }
        });

        await assertErrorResponse(response, 401, 'UNAUTHORIZED');
      });

      it('should prevent access to other family calendars', async () => {
        // Create another family and user
        const otherCtx = await createOtherFamilyContext('PARENT');

        const response = await makeTestRequest(app, {
          method: 'POST',
          path: '/api/calendar/events',
          token: otherCtx.token,
          body: {
            title: 'Test Event',
            startTime: new Date(),
            endTime: new Date(),
            familyId: ctx.family.id,
            calendarId: calendar.id
          }
        });

        await assertErrorResponse(response, 403, 'FORBIDDEN');
      });
    });

    describe('GET /events/:id', () => {
      let testEvent: any;

      beforeEach(async () => {
        testEvent = await prisma.event.create({
          data: {
            title: 'Test Event',
            description: 'Test Description',
            startTime: new Date('2024-01-01T10:00:00Z'),
            endTime: new Date('2024-01-01T11:00:00Z'),
            familyId: ctx.family.id,
            calendarId: testCalendar.id
          }
        });
      });

      it('should get an event by id', async () => {
        const response = await makeTestRequest(app, {
          method: 'GET',
          path: `/api/calendar/events/${testEvent.id}`,
          token: ctx.token
        });

        const data = await assertSuccessResponse(response);
        expect(data).toMatchObject({
          id: testEvent.id,
          title: 'Test Event',
          description: 'Test Description',
          familyId: ctx.family.id,
          calendarId: testCalendar.id
        });
      });

      it('should return 404 for non-existent event', async () => {
        const response = await makeTestRequest(app, {
          method: 'GET',
          path: '/api/calendar/events/non-existent-id',
          token: ctx.token
        });

        await assertErrorResponse(response, 404, 'EVENT_NOT_FOUND');
      });

      it('should prevent access to other family events', async () => {
        const otherCtx = await createOtherFamilyContext('PARENT');

        const response = await makeTestRequest(app, {
          method: 'GET',
          path: `/api/calendar/events/${testEvent.id}`,
          token: otherCtx.token
        });

        await assertErrorResponse(response, 403, 'FORBIDDEN');
      });
    });

    describe('PUT /events/:id', () => {
      let testEvent: any;

      beforeEach(async () => {
        // Create test calendar first
        testCalendar = await prisma.calendar.create({
          data: {
            name: 'Test Calendar',
            type: 'GOOGLE',
            familyId: ctx.family.id,
            timezone: 'UTC'
          }
        });

        // Verify calendar exists
        const verifyCalendar = await prisma.calendar.findUnique({
          where: { id: testCalendar.id }
        });
        
        if (!verifyCalendar) {
          throw new Error('Failed to create test calendar');
        }

        // Then create test event with valid calendar reference
        testEvent = await prisma.event.create({
          data: {
            title: 'Test Event',
            description: 'Test Description',
            startTime: new Date('2024-01-01T10:00:00Z'),
            endTime: new Date('2024-01-01T11:00:00Z'),
            familyId: ctx.family.id,
            calendarId: testCalendar.id  // Use the newly created calendar
          }
        });
      });

      it('should update an event', async () => {
        const response = await makeTestRequest(app, {
          method: 'PUT',
          path: `/api/calendar/events/${testEvent.id}`,
          token: ctx.token,
          body: {
            title: 'Updated Event',
            description: 'Updated Description'
          }
        });

        const data = await assertSuccessResponse(response);
        expect(data).toMatchObject({
          id: testEvent.id,
          title: 'Updated Event',
          description: 'Updated Description'
        });
      });

      it('should prevent non-parent users from updating events', async () => {
        const childCtx = await createOtherFamilyContext('CHILD');

        // Update child user's familyId to match parent's family
        await prisma.user.update({
          where: { id: childCtx.user.id },
          data: { familyId: ctx.family.id }
        });

        const response = await makeTestRequest(app, {
          method: 'PUT',
          path: `/api/calendar/events/${testEvent.id}`,
          token: childCtx.token,
          body: {
            title: 'Updated Event'
          }
        });

        await assertErrorResponse(response, 403, 'FORBIDDEN');
      });
    });

    describe('DELETE /events/:id', () => {
      let testEvent: any;

      beforeEach(async () => {
        // Create test calendar first
        testCalendar = await prisma.calendar.create({
          data: {
            name: 'Test Calendar',
            type: 'GOOGLE',
            familyId: ctx.family.id,
            timezone: 'UTC'
          }
        });

        // Then create test event with valid calendar reference
        testEvent = await prisma.event.create({
          data: {
            title: 'Test Event',
            description: 'Test Description',
            startTime: new Date('2024-01-01T10:00:00Z'),
            endTime: new Date('2024-01-01T11:00:00Z'),
            familyId: ctx.family.id,
            calendarId: testCalendar.id
          }
        });
      });

      it('should delete an event', async () => {
        const response = await makeTestRequest(app, {
          method: 'DELETE',
          path: `/api/calendar/events/${testEvent.id}`,
          token: ctx.token
        });

        await assertSuccessResponse(response);

        // Verify event is deleted
        const deletedEvent = await prisma.event.findUnique({
          where: { id: testEvent.id }
        });
        expect(deletedEvent).toBeNull();
      });

      it('should prevent non-parent users from deleting events', async () => {
        const childCtx = await createOtherFamilyContext('CHILD');

        // Update child user's familyId to match parent's family
        await prisma.user.update({
          where: { id: childCtx.user.id },
          data: { familyId: ctx.family.id }
        });

        const response = await makeTestRequest(app, {
          method: 'DELETE',
          path: `/api/calendar/events/${testEvent.id}`,
          token: childCtx.token
        });

        await assertErrorResponse(response, 403, 'FORBIDDEN');
      });
    });

    describe('GET /families/:familyId/events', () => {
      beforeEach(async () => {
        // Create test calendar first
        testCalendar = await prisma.calendar.create({
          data: {
            name: 'Test Calendar',
            type: 'GOOGLE',
            familyId: ctx.family.id,
            timezone: 'UTC'
          }
        });

        // Create multiple events using the test calendar
        await Promise.all([
          getPrisma().event.create({
            data: {
              title: 'Event 1',
              startTime: generateFutureDate(1),
              endTime: generateFutureDate(2),
              familyId: ctx.family.id,
              calendarId: testCalendar.id
            }
          }),
          getPrisma().event.create({
            data: {
              title: 'Event 2',
              startTime: generateFutureDate(3),
              endTime: generateFutureDate(4),
              familyId: ctx.family.id,
              calendarId: testCalendar.id
            }
          })
        ]);
      });

      it('should list family events', async () => {
        const response = await makeTestRequest(app, {
          method: 'GET',
          path: `/api/calendar/families/${ctx.family.id}/events`,
          token: ctx.token
        });

        const data = await assertSuccessResponse(response);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(2);
        
        // Update assertions to match new Event model structure
        const event = data[0];
        expect(event).toHaveProperty('title');
        expect(event).toHaveProperty('startTime');
        expect(event).toHaveProperty('endTime');
        expect(event).toHaveProperty('familyId');
        expect(event).toHaveProperty('calendarId');
        expect(event.familyId).toBe(ctx.family.id);
      });

      it('should filter events by date range', async () => {
        const startDate = generateFutureDate(0);
        const endDate = generateFutureDate(5);
        const response = await makeTestRequest(app, {
          method: 'GET',
          path: `/api/calendar/families/${ctx.family.id}/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
          token: ctx.token
        });

        const data = await assertSuccessResponse(response);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(2); // Should find both events
        data.forEach(event => {
          expect(new Date(event.startTime).getTime()).toBeGreaterThanOrEqual(startDate.getTime());
          expect(new Date(event.endTime).getTime()).toBeLessThanOrEqual(endDate.getTime());
        });
      });

      it('should prevent access to other family events', async () => {
        const otherCtx = await createOtherFamilyContext('PARENT');

        const response = await makeTestRequest(app, {
          method: 'GET',
          path: `/api/calendar/families/${ctx.family.id}/events`,
          token: otherCtx.token
        });

        await assertErrorResponse(response, 403, 'FORBIDDEN');
      });
    });
  });
});
