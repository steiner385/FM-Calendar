import { UserRole } from '../../../../types/user-role';

export function getTestUsers() {
  return {
    parent: {
      email: 'parent@test.com',
      role: UserRole.PARENT,
      firstName: 'Parent',
      lastName: 'User',
      password: 'test-password'
    },
    member: {
      email: 'member@test.com',
      role: UserRole.MEMBER,
      firstName: 'Member',
      lastName: 'User',
      password: 'test-password'
    }
  };
}

export function generateFutureDate(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}

export function generateTestEvent(familyId: string, calendarId: string) {
  if (!calendarId) {
    throw new Error('calendarId is required for event creation');
  }
  if (!familyId) {
    throw new Error('familyId is required for event creation');
  }
  return {
    title: 'Test Event',
    description: 'Test event description',
    startTime: generateFutureDate(1),
    endTime: generateFutureDate(2),
    location: 'Test Location',
    familyId,
    calendarId
  };
}

export function generateTestCalendar(familyId: string) {
  return {
    name: 'Test Calendar',
    description: 'Test calendar description',
    type: 'GOOGLE' as const,
    timezone: 'UTC',
    accessRole: 'reader' as const,
    familyId
  };
}

export function generateTestICalCalendar(familyId: string) {
  return {
    name: 'Test iCal Calendar',
    description: 'Test iCal calendar description',
    type: 'ICAL' as const,
    timezone: 'UTC',
    accessRole: 'reader' as const,
    familyId,
    icalUrl: 'https://example.com/calendar.ics'
  };
}
