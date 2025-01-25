import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient, type User } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
const nock = require('nock');
import app from '../../index';

const prisma = new PrismaClient();

describe('iCal Integration', () => {
  let testUser: User;
  let authToken: string;
  let testFamilyId: string;

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

    // Create auth token
    authToken = jwt.sign(
      { 
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role 
      },
      process.env.JWT_SECRET || 'test-secret'
    );

    // Mock iCal feed responses
    nock('https://example.com')
      .persist()
      .get('/calendar.ics')
      .reply(200, 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test Calendar//EN\r\nBEGIN:VEVENT\r\nUID:test-event-1@example.com\r\nSUMMARY:Test Event 1\r\nDESCRIPTION:Test Description\r\nDTSTART:20231223T100000Z\r\nDTEND:20231223T110000Z\r\nEND:VEVENT\r\nEND:VCALENDAR');
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.$transaction([
      // First delete events
      prisma.event.deleteMany({
        where: { calendarId: { in: (await prisma.calendar.findMany({ where: { familyId: testFamilyId } })).map(c => c.id) } }
      }),
      // Then delete calendars (which will cascade delete accounts)
      prisma.calendar.deleteMany({
        where: { familyId: testFamilyId }
      }),
      // Finally delete user and family
      prisma.user.delete({
        where: { id: testUser.id }
      }),
      prisma.family.delete({
        where: { id: testFamilyId }
      })
    ]);
    await prisma.$disconnect();
    nock.cleanAll();
  });

  it('should add an iCal calendar', async () => {
    const response = await app.request('/api/ical', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://example.com/calendar.ics',
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data.type).toBe('ICAL');
    expect(data.icalUrl).toBe('https://example.com/calendar.ics');
  });

  it('should sync an iCal calendar', async () => {
    // First create a calendar
    const newCalendar = await prisma.calendar.create({
      data: {
        type: 'ICAL',
        name: 'Test Calendar',
        description: 'Test iCal Calendar',
        familyId: testFamilyId,
        icalUrl: 'https://example.com/calendar.ics',
        timezone: 'UTC',
        accessRole: 'reader'
      }
    });

    const response = await app.request(`/api/ical/${newCalendar.id}/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);
    
    // Verify events were synced
    const events = await prisma.event.findMany({
      where: {
        calendarId: newCalendar.id
      }
    });

    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Test Event 1');
  });

  it('should remove an iCal calendar', async () => {
    // First create a calendar
    const newCalendar = await prisma.calendar.create({
      data: {
        type: 'ICAL',
        name: 'Test Calendar',
        description: 'Test iCal Calendar',
        familyId: testFamilyId,
        icalUrl: 'https://example.com/calendar.ics',
        timezone: 'UTC',
        accessRole: 'reader'
      }
    });

    const response = await app.request(`/api/ical/${newCalendar.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);

    // Verify calendar was deleted
    const deletedCalendar = await prisma.calendar.findUnique({
      where: { id: newCalendar.id }
    });
    expect(deletedCalendar).toBeNull();

    // Verify events were deleted
    const events = await prisma.event.findMany({
      where: {
        calendarId: newCalendar.id
      }
    });
    expect(events.length).toBe(0);
  });

  it('should not allow access to unauthorized calendars', async () => {
    // Create another user's calendar
    const timestamp = Date.now();
    const otherUser = await prisma.user.create({
      data: {
        email: `other${timestamp}@example.com`,
        password: 'hashedPassword',
        firstName: 'Other',
        lastName: 'User',
        username: `otheruser${timestamp}`,
        role: 'USER',
        family: {
          create: {
            name: 'Other Family',
          },
        },
      },
    });

    const newCalendar = await prisma.calendar.create({
      data: {
        type: 'ICAL',
        name: 'Other Calendar',
        description: 'Other Test Calendar',
        familyId: otherUser.familyId!,
        icalUrl: 'https://example.com/calendar.ics',
        timezone: 'UTC',
        accessRole: 'reader'
      }
    });

    // Try to sync
    const syncResponse = await app.request(`/api/ical/${newCalendar.id}/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    expect(syncResponse.status).toBe(403);

    // Try to delete
    const deleteResponse = await app.request(`/api/ical/${newCalendar.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    expect(deleteResponse.status).toBe(403);

    // Clean up
    await prisma.$transaction([
      prisma.calendar.delete({
        where: { id: newCalendar.id }
      }),
      prisma.user.delete({
        where: { id: otherUser.id }
      })
    ]);
  });
});
