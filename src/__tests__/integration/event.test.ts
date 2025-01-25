import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { Response } from 'supertest';
import { setupTestContext, cleanup, createTestUser, getPrisma } from '../utils/setup';
import type { TestContext, ExtendedTestContext, EventResponse } from '../utils/setup';
import { getTestUsers, generateFutureDate } from '../utils/test-utils';
import { assertErrorResponse, assertSuccessResponse } from '../../../../__tests__/test-helpers';
import type { Prisma } from '@prisma/client';

type EventCreateData = Prisma.EventUncheckedCreateInput;

describe('Event Management Endpoints', () => {
  jest.setTimeout(30000);
  
  let context: ExtendedTestContext;
  let testUsers: ReturnType<typeof getTestUsers>;
  let testCalendar: any;

  beforeAll(async () => {
    console.log('Starting test suite setup...');
    try {
      testUsers = getTestUsers();
      context = await setupTestContext() as ExtendedTestContext;
      console.log('Test suite setup complete');
    } catch (error) {
      console.error('Test suite setup failed:', error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    console.log('Starting test suite cleanup...');
    try {
      await Promise.race([
        Promise.all([
          Promise.race([cleanup.database(), new Promise((_, reject) => setTimeout(() => reject(new Error('Database cleanup timeout')), 5000))]),
          Promise.race([cleanup.server(), new Promise((_, reject) => setTimeout(() => reject(new Error('Server cleanup timeout')), 5000))]),
          cleanup.processListeners()
        ]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('afterAll cleanup timeout')), 5000)
        )
      ]);
      console.log('Test suite cleanup complete');
    } catch (error) {
      console.error('Test suite cleanup failed:', error);
      throw error;
    }
  });

  afterEach(async () => {
    console.log('Starting test case cleanup...');
    try {
      await cleanup.database();
      console.log('Test case cleanup complete');
    } catch (error) {
      console.error('Database cleanup error:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    console.log('Starting test case setup...');
    try {
      await Promise.race([
        (async () => {
          console.log('Cleaning database...');
          await cleanup.database();
          console.log('Database cleaned');

          console.log('Creating parent user...');
          const parentResponse = await createTestUser(testUsers.parent);
          context.parentToken = parentResponse.token;
          context.parentId = parentResponse.user.id;
          console.log('Parent user created');

          console.log('Creating member user...');
          const memberResponse = await createTestUser(testUsers.member);
          context.memberToken = memberResponse.token;
          context.memberId = memberResponse.user.id;
          console.log('Member user created');

          console.log('Creating family...');
          try {
            const family = await getPrisma().family.create({
              data: {
                name: 'Test Family',
                members: {
                  connect: [
                    { id: context.parentId },
                    { id: context.memberId }
                  ]
                }
              }
            });
            context.familyId = family.id;
            console.log('Family created with ID:', family.id);

            await Promise.all([
              getPrisma().user.update({
                where: { id: context.parentId },
                data: { familyId: family.id }
              }),
              getPrisma().user.update({
                where: { id: context.memberId },
                data: { familyId: family.id }
              })
            ]);
            console.log('Users updated with family ID');

            testCalendar = await getPrisma().calendar.create({
              data: {
                name: 'Test Calendar',
                type: 'GOOGLE',
                familyId: family.id,
                timezone: 'UTC'
              }
            });

          } catch (error) {
            console.error('Setup error:', error);
            throw error;
          }

          console.log('Test case setup complete');
        })(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('beforeEach timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.error('Test setup error:', error);
      try {
        await cleanup.database();
      } catch (cleanupError) {
        console.error('Cleanup after setup error failed:', cleanupError);
      }
      throw error;
    }
  });

  describe('POST /api/calendar/events', () => {
    it('should create a new event as a family member', async () => {
      const startTime = generateFutureDate(1);
      const endTime = generateFutureDate(2);
      
      const eventData = {
        title: 'Family Dinner',
        description: 'Weekly family dinner',
        startTime,
        endTime,
        location: 'Home',
        familyId: context.familyId,
        calendarId: testCalendar.id
      };

      const response: Response = await context.agent
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${context.memberToken}`)
        .send(eventData);

      const data = await assertSuccessResponse(response, 201);
      expect(data).toHaveProperty('id');
      expect(data.title).toBe(eventData.title);
      expect(data.location).toBe(eventData.location);
      expect(data.calendarId).toBe(testCalendar.id);
      expect(new Date(data.startTime)).toEqual(new Date(startTime));
      expect(new Date(data.endTime)).toEqual(new Date(endTime));
    });

    it('should not create event without family membership', async () => {
      const outsiderResponse = await createTestUser({
        ...testUsers.member,
        email: 'outsider@test.com'
      });

      const response: Response = await context.agent
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${outsiderResponse.token}`)
        .send({
          title: 'Test Event',
          startTime: generateFutureDate(1),
          endTime: generateFutureDate(2),
          familyId: context.familyId,
          calendarId: testCalendar.id
        });

      await assertErrorResponse(response, 403, 'FORBIDDEN');
    });

    it('should validate event data', async () => {
      const response: Response = await context.agent
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${context.memberToken}`)
        .send({
          title: '', // Empty title
          startTime: 'invalid-date',
          endTime: generateFutureDate(1),
          familyId: context.familyId,
          calendarId: testCalendar.id
        });

      await assertErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('should validate event dates', async () => {
      const response: Response = await context.agent
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${context.memberToken}`)
        .send({
          title: 'Test Event',
          startTime: generateFutureDate(2), // Start after end
          endTime: generateFutureDate(1),
          familyId: context.familyId,
          calendarId: testCalendar.id
        });

      await assertErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/calendar/events/:id', () => {
    beforeEach(async () => {
      if (!context.familyId || !testCalendar?.id) {
        throw new Error('Required test context not initialized');
      }

      const eventData: EventCreateData = {
        title: 'Test Event',
        startTime: generateFutureDate(1),
        endTime: generateFutureDate(2),
        familyId: context.familyId,
        calendarId: testCalendar.id,
        userId: context.memberId
      };

      const event = await getPrisma().event.create({
        data: eventData
      });
      context.eventId = event.id;
    });

    it('should get event details as a family member', async () => {
      const response: Response = await context.agent
        .get(`/api/calendar/events/${context.eventId}`)
        .set('Authorization', `Bearer ${context.memberToken}`);

      const data = await assertSuccessResponse(response);
      expect(data.id).toBe(context.eventId);
      expect(data.title).toBe('Test Event');
    });

    it('should not get event without family membership', async () => {
      const outsiderResponse = await createTestUser({
        ...testUsers.member,
        email: 'outsider@test.com'
      });

      const response: Response = await context.agent
        .get(`/api/calendar/events/${context.eventId}`)
        .set('Authorization', `Bearer ${outsiderResponse.token}`);

      await assertErrorResponse(response, 403, 'FORBIDDEN');
    });
  });

  describe('PUT /api/calendar/events/:id', () => {
    beforeEach(async () => {
      if (!context.familyId || !testCalendar?.id) {
        throw new Error('Required test context not initialized');
      }

      const eventData: EventCreateData = {
        title: 'Test Event',
        startTime: generateFutureDate(1),
        endTime: generateFutureDate(2),
        familyId: context.familyId,
        calendarId: testCalendar.id,
        userId: context.memberId
      };

      const event = await getPrisma().event.create({
        data: eventData
      });
      context.eventId = event.id;
    });

    it('should update event details as parent', async () => {
      const updateData = {
        title: 'Updated Event',
        location: 'New Location'
      };

      const response: Response = await context.agent
        .put(`/api/calendar/events/${context.eventId}`)
        .set('Authorization', `Bearer ${context.parentToken}`)
        .send(updateData);

      const data = await assertSuccessResponse(response);
      expect(data.title).toBe(updateData.title);
      expect(data.location).toBe(updateData.location);
    });

    it('should not update event as regular member', async () => {
      const updateData = {
        title: 'Updated Event',
        location: 'New Location'
      };

      const response: Response = await context.agent
        .put(`/api/calendar/events/${context.eventId}`)
        .set('Authorization', `Bearer ${context.memberToken}`)
        .send(updateData);

      await assertErrorResponse(response, 403, 'FORBIDDEN');
    });

    it('should validate updated event dates', async () => {
      const response: Response = await context.agent
        .put(`/api/calendar/events/${context.eventId}`)
        .set('Authorization', `Bearer ${context.parentToken}`)
        .send({
          startTime: generateFutureDate(2),
          endTime: generateFutureDate(1)
        });

      await assertErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/calendar/events/:id', () => {
    beforeEach(async () => {
      if (!context.familyId || !testCalendar?.id) {
        throw new Error('Required test context not initialized');
      }

      const eventData: EventCreateData = {
        title: 'Test Event',
        startTime: generateFutureDate(1),
        endTime: generateFutureDate(2),
        familyId: context.familyId,
        calendarId: testCalendar.id,
        userId: context.memberId
      };

      const event = await getPrisma().event.create({
        data: eventData
      });
      context.eventId = event.id;
    });

    it('should delete event as parent', async () => {
      const response: Response = await context.agent
        .delete(`/api/calendar/events/${context.eventId}`)
        .set('Authorization', `Bearer ${context.parentToken}`);

      const data = await assertSuccessResponse(response);
      expect(data.message).toBe('Event deleted successfully');

      const getResponse: Response = await context.agent
        .get(`/api/calendar/events/${context.eventId}`)
        .set('Authorization', `Bearer ${context.parentToken}`);
      
      await assertErrorResponse(getResponse, 404, 'EVENT_NOT_FOUND');
    });

    it('should not delete event as regular member', async () => {
      const response: Response = await context.agent
        .delete(`/api/calendar/events/${context.eventId}`)
        .set('Authorization', `Bearer ${context.memberToken}`);

      await assertErrorResponse(response, 403, 'FORBIDDEN');
    });
  });

  describe('GET /api/calendar/families/:id/events', () => {
    beforeEach(async () => {
      if (!context.familyId || !testCalendar?.id) {
        throw new Error('Required test context not initialized');
      }

      const eventData1: EventCreateData = {
        title: 'Event 1',
        startTime: generateFutureDate(1),
        endTime: generateFutureDate(2),
        familyId: context.familyId,
        calendarId: testCalendar.id,
        userId: context.memberId
      };

      const eventData2: EventCreateData = {
        title: 'Event 2',
        startTime: generateFutureDate(3),
        endTime: generateFutureDate(4),
        familyId: context.familyId,
        calendarId: testCalendar.id,
        userId: context.memberId
      };

      await Promise.all([
        getPrisma().event.create({ data: eventData1 }),
        getPrisma().event.create({ data: eventData2 })
      ]);
    });

    it('should list all family events as member', async () => {
      const response: Response = await context.agent
        .get(`/api/calendar/families/${context.familyId}/events`)
        .set('Authorization', `Bearer ${context.memberToken}`);

      const data = await assertSuccessResponse(response);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(2);
      
      const event = data[0] as EventResponse;
      expect(event).toHaveProperty('title');
      expect(event).toHaveProperty('startTime');
      expect(event).toHaveProperty('endTime');
      expect(event).toHaveProperty('familyId');
      expect(event).toHaveProperty('calendarId');
      expect(event.familyId).toBe(context.familyId);
    });

    it('should filter events by date range', async () => {
      const startDate = generateFutureDate(0);
      const endDate = generateFutureDate(5);

      const response: Response = await context.agent
        .get(`/api/calendar/families/${context.familyId}/events`)
        .query({ 
          startDate: startDate,
          endDate: endDate 
        })
        .set('Authorization', `Bearer ${context.memberToken}`);

      const data = await assertSuccessResponse(response);
      expect(Array.isArray(data)).toBe(true);
      
      data.forEach((event: EventResponse) => {
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);
        expect(eventStart >= new Date(startDate)).toBe(true);
        expect(eventEnd <= new Date(endDate)).toBe(true);
      });
    });

    it('should sort events by start time', async () => {
      const response: Response = await context.agent
        .get(`/api/calendar/families/${context.familyId}/events`)
        .query({ sortBy: 'startTime', order: 'asc' })
        .set('Authorization', `Bearer ${context.memberToken}`);

      const data = await assertSuccessResponse(response);
      expect(Array.isArray(data)).toBe(true);
      
      const startTimes = data.map((event: EventResponse) => new Date(event.startTime).getTime());
      const sortedStartTimes = [...startTimes].sort((a, b) => a - b);
      expect(startTimes).toEqual(sortedStartTimes);
    });
  });
});
