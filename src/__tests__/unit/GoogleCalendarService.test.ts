import { GoogleCalendarService } from '../../../services/GoogleCalendarService';
import { google } from 'googleapis';
import { PrismaClient, Calendar, User } from '@prisma/client';
import { encrypt, decrypt } from '../../../utils/encryption';
import { logger } from '../../../utils/logger';
import { createMockEncrypted } from '../../../__tests__/utils/test-utils';

// Mock the service module
jest.mock('../../../services/GoogleCalendarService', () => ({
  GoogleCalendarService: jest.fn().mockImplementation(() => ({
    handleOAuthCallback: jest.fn(),
    addCalendar: jest.fn(),
    removeCalendar: jest.fn(),
    getCalendarList: jest.fn(),
    syncCalendar: jest.fn(),
    createEvent: jest.fn(),
    updateEvent: jest.fn(),
    deleteEvent: jest.fn(),
  }))
}));

jest.mock('googleapis');
jest.mock('@prisma/client');
jest.mock('../../../utils/encryption');
jest.mock('../../../utils/logger');

describe('GoogleCalendarController', () => {
    let service: GoogleCalendarService;
    let mockPrisma: any;
    let mockCalendarApi: any;
    let mockOAuth2Client: any;

    beforeEach(() => {
        mockPrisma = {
            user: { findUnique: jest.fn() },
            calendar: { create: jest.fn(), findUnique: jest.fn() },
            event: { create: jest.fn() },
            $transaction: jest.fn()
        };

        mockCalendarApi = {
            calendars: {
                get: jest.fn(),
            },
            events: {
                insert: jest.fn(),
                list: jest.fn()
            },
        };

        // Properly mock google.auth.OAuth2
        const mockRequest = jest.fn().mockResolvedValue({ data: {} });
        (google.auth.OAuth2 as any) = jest.fn(() => ({
            request: mockRequest,
            setCredentials: jest.fn(),
            getAccessToken: jest.fn().mockResolvedValue({ token: 'test-access-token', refresh_token: 'test-refresh-token' })
        }));

        service = new GoogleCalendarService(true);
        (service as any).prisma = mockPrisma;

        (encrypt as jest.Mock).mockImplementation((text) => `encrypted-${text}`);
        (decrypt as jest.Mock).mockImplementation((text) => text.replace('encrypted-', ''));
    });

    describe('addCalendar', () => {
        // ... (test cases remain unchanged)
    });

    describe('createEvent', () => {
        it('should create an event successfully', async () => {
            // ... (test implementation)
        });

        it('should handle calendar not found', async () => {
            // ... (test implementation)
        });

        it('should handle decryption errors', async () => {
            // ... (test implementation)
        });
    });

    describe('syncCalendar', () => {
        it('should sync events successfully', async () => {
            // ... (test implementation)
        });
        // ... other tests
    });
});
