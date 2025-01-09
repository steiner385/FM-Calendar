import { describe, expect, it, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient, type User, type Prisma } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
const nock = require('nock');
import app from '../../index';
import { encrypt } from '../../utils/encryption';

const prisma = new PrismaClient();

describe('Google Calendar Integration', () => {
  let testUser: User;
  let authToken: string;
  let testFamilyId: string;
  let testCalendarId: string;

  beforeAll(async () => {
    // Create test user with unique username
    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        email: `test${timestamp}@example.com`,
        password: 'hashedPassword',
        firstName: 'Test',
        lastName: 'User',
        username: `testuser${timestamp}`,
        role: 'USER',
        family: {
          create: {
            name: 'Test Family',
          },
        },
      },
      include: {
        family: true,
      },
    });

    testFamilyId = testUser.familyId!;
    testCalendarId = `test-calendar-${timestamp}`;

    // Create auth token
    authToken = jwt.sign(
      { 
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role 
      },
      process.env.JWT_SECRET || 'development-secret-key-change-in-production'
    );

    // Mock Google Calendar API responses
    const scope = nock('https://www.googleapis.com')
      .persist()
      .post('/oauth2/v4/token')
      .reply(200, {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expiry_date: Date.now() + 3600000
      })
      .get(`/calendar/v3/calendars/${testCalendarId}`)
      .reply(200, {
        id: testCalendarId,
        summary: 'Test Calendar',
        timeZone: 'UTC'
      })
      .get(`/calendar/v3/calendars/${testCalendarId}/events`)
      .query({
        singleEvents: 'true',
        orderBy: 'startTime'
      })
      .reply(200, {
        items: [
          {
            id: 'test-event-1',
            summary: 'Test Event 1',
            description: 'Test Description',
            start: { dateTime: '2024-01-01T10:00:00Z' },
            end: { dateTime: '2024-01-01T11:00:00Z' }
          }
        ],
        nextSyncToken: 'test-sync-token'
      })
      .post(`/calendar/v3/calendars/${testCalendarId}/events`)
      .reply(200, {
        id: 'new-event-id',
        summary: 'New Event',
        description: 'New Description',
        start: { dateTime: '2024-01-01T10:00:00Z' },
        end: { dateTime: '2024-01-01T11:00:00Z' }
      })
      .put(new RegExp(`/calendar/v3/calendars/${testCalendarId}/events/.*`))
      .reply(200, {
        id: 'updated-event-id',
        summary: 'Updated Event',
        description: 'Updated Description',
        start: { dateTime: '2024-01-01T10:00:00Z' },
        end: { dateTime: '2024-01-01T11:00:00Z' }
      })
      .delete(new RegExp(`/calendar/v3/calendars/${testCalendarId}/events/.*`))
      .reply(200);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.$transaction([
      prisma.event.deleteMany({
        where: { calendar: { familyId: testFamilyId } }
      }),
      prisma.calendar.deleteMany({
        where: { familyId: testFamilyId }
      }),
      prisma.user.delete({
        where: { id: testUser.id }
      })
    ]);
    await prisma.$disconnect();
    nock.cleanAll();
  });

  beforeEach(async () => {
    // Clean up calendars and events before each test
    await prisma.$transaction([
      prisma.event.deleteMany({
        where: { calendar: { familyId: testFamilyId } }
      }),
      prisma.calendar.deleteMany({
        where: { familyId: testFamilyId }
      })
    ]);
  });

  describe('Calendar Management', () => {
    it('should add a Google calendar', async () => {
      const response = await app.request('/api/google-calendar/calendars', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calendarId: testCalendarId,
          tokens: {
            access_token: 'test-token',
            refresh_token: 'test-refresh-token',
            expiry_date: Date.now() + 3600000
          }
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.googleCalendarId).toBe(testCalendarId);
      expect(data.type).toBe('GOOGLE');
    });

    it('should sync a Google calendar', async () => {
      // First create a calendar
      const calendar = await prisma.calendar.create({
        data: {
          type: 'GOOGLE',
          googleCalendarId: testCalendarId,
          name: 'Test Calendar',
          familyId: testFamilyId,
          accessToken: encrypt('test-token'),
          refreshToken: encrypt('test-refresh-token')
        }
      });

      const response = await app.request(`/api/google-calendar/calendars/${calendar.id}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      
      // Verify events were synced
      const events = await prisma.event.findMany({
        where: {
          calendarId: calendar.id
        }
      });

      expect(events.length).toBe(1);
      expect(events[0].title).toBe('Test Event 1');
    });
  });

  describe('Event Management', () => {
    let testCalendar: any;

    beforeEach(async () => {
      // Create test calendar for events
      testCalendar = await prisma.calendar.create({
        data: {
          type: 'GOOGLE',
          googleCalendarId: testCalendarId,
          name: 'Test Calendar',
          familyId: testFamilyId,
          accessToken: encrypt('test-token'),
          refreshToken: encrypt('test-refresh-token')
        }
      });
    });

    it('should create a single event', async () => {
      const eventData = {
        title: 'New Event',
        description: 'New Description',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:00:00Z',
        calendarId: testCalendar.id
      };

      const response = await app.request(`/api/google-calendar/calendars/${testCalendar.id}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      expect(response.status).toBe(201);  // Changed to 201 for resource creation
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.title).toBe(eventData.title);
      expect(data.description).toBe(eventData.description);
    });

    it('should update an event', async () => {
      // Create test event
      const event = await prisma.event.create({
        data: {
          title: 'Original Title',
          description: 'Original Description',
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T11:00:00Z'),
          calendarId: testCalendar.id,
          familyId: testFamilyId
        }
      });

      const updates = {
        title: 'Updated Title',
        description: 'Updated Description'
      };

      const response = await app.request(`/api/google-calendar/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.title).toBe(updates.title);
      expect(data.description).toBe(updates.description);
    });

    it('should delete an event', async () => {
      // Create test event
      const event = await prisma.event.create({
        data: {
          title: 'Event to Delete',
          description: 'Will be deleted',
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T11:00:00Z'),
          calendarId: testCalendar.id,
          familyId: testFamilyId
        }
      });

      const response = await app.request(`/api/google-calendar/events/${event.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);

      // Verify event was deleted
      const deletedEvent = await prisma.event.findUnique({
        where: { id: event.id }
      });
      expect(deletedEvent).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthorized access', async () => {
      const response = await app.request('/api/google-calendar/calendars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
    });

    it('should handle invalid calendar ID', async () => {
      const response = await app.request('/api/google-calendar/calendars/invalid-id/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Calendar not available');
    });

    it('should handle invalid event data', async () => {
      const response = await app.request('/api/google-calendar/calendars/test-id/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required fields
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Calendar not available');
    });
  });
});
