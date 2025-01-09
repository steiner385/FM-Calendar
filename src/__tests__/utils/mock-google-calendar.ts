import { jest } from '@jest/globals';
import { encrypt } from '../../../../utils/encryption';
import { calendar_v3 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';

// Mock tokens - use raw tokens for API requests
export const mockTokens: Credentials = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expiry_date: Date.now() + 3600000, // 1 hour from now
  token_type: 'Bearer',
  id_token: 'test-id-token',
  scope: 'https://www.googleapis.com/auth/calendar'
};

// Encrypted tokens for database storage
export const encryptedTokens = {
  accessToken: encrypt(mockTokens.access_token || ''),
  refreshToken: encrypt(mockTokens.refresh_token || '')
};

// Mock response data
const mockCalendarData = {
  id: 'test-calendar-id',
  summary: 'Test Calendar',
  description: 'Test calendar description',
  timeZone: 'UTC',
  accessRole: 'owner'
} as calendar_v3.Schema$Calendar;

const mockEventData = {
  id: 'test-event-id',
  summary: 'Test Event',
  description: 'Test event description',
  start: { dateTime: '2025-01-01T10:00:00Z' },
  end: { dateTime: '2025-01-01T11:00:00Z' },
  location: 'Test Location',
  status: 'confirmed'
} as calendar_v3.Schema$Event;

// Create mock calendar API
function createMockCalendarApi() {
  const api = {
    calendars: {
      get: jest.fn() as jest.MockedFunction<() => Promise<{ data: calendar_v3.Schema$Calendar }>>,
      list: jest.fn() as jest.MockedFunction<() => Promise<{ data: { items: calendar_v3.Schema$Calendar[] } }>>
    },
    events: {
      delete: jest.fn() as jest.MockedFunction<() => Promise<{ data: {} }>>,
      insert: jest.fn() as jest.MockedFunction<() => Promise<{ data: calendar_v3.Schema$Event }>>,
      list: jest.fn() as jest.MockedFunction<() => Promise<{ data: { items: calendar_v3.Schema$Event[] } }>>,
      update: jest.fn() as jest.MockedFunction<() => Promise<{ data: calendar_v3.Schema$Event }>>
    }
  };

  // Setup mock implementations
  api.calendars.get.mockResolvedValue({ data: mockCalendarData });
  api.calendars.list.mockResolvedValue({ data: { items: [mockCalendarData] } });
  api.events.delete.mockResolvedValue({ data: {} });
  api.events.insert.mockResolvedValue({ data: mockEventData });
  api.events.list.mockResolvedValue({ data: { items: [mockEventData] } });
  api.events.update.mockResolvedValue({ data: mockEventData });

  return api;
}

// Create mock OAuth2Client
function createMockOAuth2Client() {
  const client = {
    credentials: mockTokens,
    setCredentials: jest.fn() as jest.MockedFunction<(creds: Credentials) => void>,
    getAccessToken: jest.fn() as jest.MockedFunction<() => Promise<{ res: null; credentials: Credentials }>>,
    getToken: jest.fn() as jest.MockedFunction<() => Promise<{ tokens: Credentials }>>,
    refreshAccessToken: jest.fn() as jest.MockedFunction<() => Promise<{ res: null; credentials: Credentials }>>,
    generateAuthUrl: jest.fn() as jest.MockedFunction<() => string>,
    getRequestHeaders: jest.fn() as jest.MockedFunction<() => Promise<{ Authorization: string }>>,
    request: jest.fn() as jest.MockedFunction<(opts: any) => Promise<{ data: any }>>,
    refreshToken: jest.fn() as jest.MockedFunction<() => Promise<Credentials>>,
    verifyIdToken: jest.fn() as jest.MockedFunction<() => Promise<{ getPayload: () => { sub: string } }>>,
    getTokenInfo: jest.fn() as jest.MockedFunction<() => Promise<{ access_token: string | null | undefined }>>
  };

  // Setup mock implementations
  client.getAccessToken.mockResolvedValue({ res: null, credentials: mockTokens });
  client.getToken.mockResolvedValue({ tokens: mockTokens });
  client.refreshAccessToken.mockResolvedValue({ res: null, credentials: mockTokens });
  client.generateAuthUrl.mockReturnValue('');
  client.getRequestHeaders.mockResolvedValue({ Authorization: `Bearer ${mockTokens.access_token}` });
  client.request.mockImplementation(async (opts: any) => {
    if (opts.url?.includes('/calendars/')) {
      return { data: { id: 'test-calendar-id' } };
    }
    if (opts.url?.includes('/events')) {
      return { data: { items: [] } };
    }
    return { data: {} };
  });
  client.refreshToken.mockResolvedValue(mockTokens);
  client.verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'test-user-id' }) });
  client.getTokenInfo.mockResolvedValue({ access_token: mockTokens.access_token });

  return client;
}

let mockCalendarApi: ReturnType<typeof createMockCalendarApi>;
let mockOAuth2Client: ReturnType<typeof createMockOAuth2Client>;

// Export setup functions
export function setupGoogleCalendarMocks() {
  // Create fresh instances
  mockCalendarApi = createMockCalendarApi();
  mockOAuth2Client = createMockOAuth2Client();

  // Mock the modules
  jest.mock('googleapis', () => ({
    google: {
      calendar: () => mockCalendarApi,
      auth: {
        OAuth2Client: jest.fn().mockImplementation(() => mockOAuth2Client),
        GoogleAuth: jest.fn().mockImplementation(() => ({ 
          getClient: () => mockOAuth2Client 
        }))
      }
    }
  }));

  jest.mock('google-auth-library', () => ({
    OAuth2Client: jest.fn().mockImplementation(() => mockOAuth2Client),
    GoogleAuth: jest.fn().mockImplementation(() => ({ 
      getClient: () => mockOAuth2Client 
    }))
  }));

  // Mock axios to prevent real HTTP requests
  jest.mock('axios', () => ({
    create: () => ({
      request: jest.fn().mockImplementation(async () => ({ data: {} })),
      get: jest.fn().mockImplementation(async () => ({ data: {} })),
      post: jest.fn().mockImplementation(async () => ({ data: {} }))
    })
  }));

  // Mock gaxios to prevent real HTTP requests
  jest.mock('gaxios', () => ({
    request: jest.fn().mockImplementation(async () => ({ data: {} }))
  }));

  // Set environment variables
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/callback';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-min-32-chars-1234567890!!';
}

export function clearGoogleCalendarMocks() {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset modules
  jest.resetModules();
  
  // Clear references
  mockCalendarApi = null as any;
  mockOAuth2Client = null as any;
  
  // Clear module mocks
  jest.unmock('googleapis');
  jest.unmock('google-auth-library');
  jest.unmock('axios');
  jest.unmock('gaxios');
}

// Export mocks for test verification
export const mocks = {
  get calendar() { return mockCalendarApi; },
  get oauth() { return mockOAuth2Client; }
};
