import axios from 'axios';
import { jest } from '@jest/globals';

// Mock iCal data
const mockICalData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test Calendar//EN
BEGIN:VEVENT
UID:test-event@example.com
SUMMARY:Test Event
DESCRIPTION:Test Description
LOCATION:Test Location
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
END:VEVENT
END:VCALENDAR`;

export function setupICalMocks() {
  // Mock axios get to return fake iCal data
  jest.spyOn(axios, 'get').mockImplementation(async () => ({
    status: 200,
    data: mockICalData,
    headers: {
      etag: 'test-etag'
    }
  }));
}

export function clearICalMocks() {
  jest.restoreAllMocks();
}
