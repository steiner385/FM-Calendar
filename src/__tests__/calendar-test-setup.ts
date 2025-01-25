import type { SuperTest, Test } from 'supertest';
import { setupTestContext, type TestContext } from '../../../__tests__/core/utils/test-setup.js';
import { prisma } from '../../../lib/prisma.js';
import { hashPassword, generateToken } from '../../../utils/auth.js';
import { UserRole } from '../../../types/user-role.js';
import { CalendarType } from '../types';
import { EventEmitter } from 'events';
import { CalendarService } from '../services/calendar.service';
import { EventService } from '../services/event.service';

export interface CalendarTestContext extends TestContext {
  parentToken: string;
  memberToken: string;
  familyId: string;
  calendarId?: string;
  eventId?: string;
  memberId: string;
  parentId: string;
  calendarService: CalendarService;
  eventService: EventService;
  eventEmitter: EventEmitter;
}

export async function setupCalendarTest(): Promise<CalendarTestContext> {
  const baseContext = await setupTestContext() as CalendarTestContext;
  
  // Create users via Prisma directly
  const parent = await prisma.user.create({
    data: {
      email: 'testparent@test.com',
      password: await hashPassword('TestPass123!'),
      firstName: 'Test',
      lastName: 'Parent',
      role: UserRole.PARENT,
      username: 'testparent_' + Date.now()
    }
  });

  const member = await prisma.user.create({
    data: {
      email: 'testmember@test.com',
      password: await hashPassword('TestPass123!'),
      firstName: 'Test',
      lastName: 'Member',
      role: UserRole.MEMBER,
      username: 'testmember_' + Date.now()
    }
  });

  // Create family with relationships in a transaction
  const family = await prisma.$transaction(async (tx) => {
    const newFamily = await tx.family.create({
      data: {
        name: 'Test Family',
        members: {
          connect: [{ id: parent.id }, { id: member.id }]
        }
      }
    });

    // Update both users with familyId
    await tx.user.updateMany({
      where: { id: { in: [parent.id, member.id] } },
      data: { familyId: newFamily.id }
    });

    return newFamily;
  });

  // Generate tokens
  const parentToken = await generateToken({
    userId: parent.id,
    email: parent.email,
    role: parent.role
  });

  const memberToken = await generateToken({
    userId: member.id,
    email: member.email,
    role: member.role
  });

  // Create event emitter and services
  const eventEmitter = new EventEmitter();
  const calendarService = new CalendarService(eventEmitter);
  const eventService = new EventService(eventEmitter, calendarService);

  return {
    ...baseContext,
    parentToken,
    memberToken,
    familyId: family.id,
    memberId: member.id,
    parentId: parent.id,
    calendarService,
    eventService,
    eventEmitter
  };
}

export async function cleanupCalendarTest(): Promise<void> {
  await prisma.$transaction([
    prisma.calendarEvent.deleteMany(),
    prisma.calendarPermission.deleteMany(),
    prisma.calendar.deleteMany(),
    prisma.user.deleteMany(),
    prisma.family.deleteMany()
  ]);
  await prisma.$disconnect();
}
