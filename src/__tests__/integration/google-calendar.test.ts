import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { Response as SuperTestResponse } from 'supertest';
import { setupTestContext, createOtherFamilyContext, cleanup, setupTestDb, cleanupTestData, getPrisma, createTestApp, makeTestRequest } from '../utils/setup';
import type { TestContext, CalendarEnv } from '../utils/setup';
import { getTestUsers, generateTestCalendar } from '../utils/test-utils';
import { assertSuccessResponse, assertErrorResponse } from '../../../../__tests__/test-helpers';
import { setupGoogleCalendarMocks, clearGoogleCalendarMocks, mockTokens, encryptedTokens } from '../utils/mock-google-calendar';
import { generateToken } from '../../utils/auth';
import { GoogleCalendarService } from '../../services/google/GoogleCalendarService';
import { GoogleCalendarPlugin } from '../../plugins/google/GoogleCalendarPlugin';
import { GoogleCalendarController } from '../../controllers/google/GoogleCalendarController';
import { PluginManager } from '../../../../core/plugin/PluginManager';
import { EventBus } from '../../../../core/events/bus';
import { BasePlugin } from '../../../../core/plugin/base';
import type { PluginContext } from '../../../../core/plugin/types';
import { pluginRegistry } from '../../../../plugins/registry';
import { Hono } from 'hono';
import type { BlankEnv } from 'hono/types';
import calendarRouter from '../../routes';

describe('Google Calendar Integration', () => {
  let context: TestContext;
  let testUsers: ReturnType<typeof getTestUsers>;
  let app: Hono<CalendarEnv>;
  let eventBus: EventBus;

  let pluginManager: PluginManager;
  let calendarPlugin: BasePlugin;
  let googlePlugin: GoogleCalendarPlugin;

  beforeAll(async () => {
    // Set up test environment
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/callback';
    process.env.ENCRYPTION_KEY = 'test-encryption-key-min-32-chars-1234567890!!';

    // Initialize database and context
    await setupTestDb();
    context = await setupTestContext();
    testUsers = getTestUsers();
    setupGoogleCalendarMocks();

    // Create and configure test app
    app = createTestApp({ enableAuth: true });
    app.route('/api/calendar', calendarRouter);

    // Initialize event bus (singleton)
    eventBus = EventBus.getInstance({
      validator: {
        numWorkers: 1 // Minimal validation for tests
      },
      batcher: {
        maxBatchSize: 10,
        maxWaitTime: 100
      },
      router: {
        channelTTL: 1000 // Short TTL for tests
      },
      compressor: {
        compressionLevel: 0, // No compression for tests
        minSize: Number.MAX_SAFE_INTEGER // Effectively disable compression
      }
    });
    await eventBus.start();

    // Initialize plugin manager
    pluginManager = PluginManager.getInstance();
    await pluginManager.initialize({
      app: app as any,
      prisma: getPrisma(),
      plugins: pluginRegistry,
      config: {
        env: 'test',
        debug: false,
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: process.env.GOOGLE_REDIRECT_URI!
      },
      logMetadata: { service: 'calendar-test' }
    });

    // Initialize plugins
    calendarPlugin = new class extends BasePlugin {
      readonly metadata = {
        name: 'calendar',
        version: '1.0.0',
        description: 'Base calendar plugin'
      };
      protected async onInitialize() {}
      protected async onTeardown() {}
    }();
    await pluginManager.registerPlugin(calendarPlugin);

    googlePlugin = new GoogleCalendarPlugin();
    await pluginManager.registerPlugin(googlePlugin);

    // Set up service
    const service = new GoogleCalendarService(true);
    GoogleCalendarController.setService(service);
  });

  afterAll(async () => {
    try {
      // Clean up plugins
      if (pluginManager) {
        await pluginManager.unregisterPlugin('google-calendar');
        await pluginManager.unregisterPlugin('calendar');
        pluginManager.clearPlugins();
      }

      // Clean up event bus
      if (eventBus) {
        await eventBus.stop();
        EventBus.resetInstance();
      }

      // Clean up test resources
      await Promise.all([
        cleanup.database(),
        cleanup.server(),
        cleanup.processListeners()
      ]);
      clearGoogleCalendarMocks();

      // Close database connection
      const prisma = getPrisma();
      await prisma.$disconnect();
    } catch (error) {
      console.error('Cleanup error:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clean up previous test data
    await cleanupTestData();
    
    // Reset context with minimal data
    const newContext = await setupTestContext();
    Object.assign(context, {
      user: newContext.user,
      family: newContext.family,
      token: await generateToken({
        userId: newContext.user.id,
        email: newContext.user.email,
        role: newContext.user.role
      })
    });

    // Reset mocks
    jest.clearAllMocks();
    setupGoogleCalendarMocks();
  });

  describe('POST /api/calendar/google/calendars', () => {
    it('should add a Google calendar', async () => {
    const response: SuperTestResponse = await makeTestRequest(app, {
      method: 'POST',
      path: '/api/calendar/google/calendars',
      token: context.token,
      body: {
        calendarId: 'test-calendar-id',
        tokens: mockTokens
      }
    });

      console.log('Response:', response.body);
      const data = await assertSuccessResponse(response, 201);
      expect(data).toHaveProperty('id');
      expect(data.type).toBe('GOOGLE');
      expect(data.googleCalendarId).toBe('test-calendar-id');
    });

    it('should not add calendar without family membership', async () => {
      const outsiderResponse = await makeTestRequest(app, {
        method: 'POST',
        path: '/api/calendar/google/calendars',
        token: 'invalid-token',
        body: {
          calendarId: 'test-calendar-id',
          tokens: mockTokens
        }
      });

      expect(outsiderResponse.status).toBe(401);
    });
  });

  describe('GET /api/calendar/google/calendars', () => {
    beforeEach(async () => {
      // Add a test calendar directly to database
      const prisma = getPrisma();
      const calendarData = generateTestCalendar(context.family.id);
      const calendar = await prisma.calendar.create({
        data: {
          ...calendarData,
          type: 'GOOGLE',
          familyId: context.family.id,
          googleCalendarId: 'test-calendar-id',
          accessToken: encryptedTokens.accessToken,
          refreshToken: encryptedTokens.refreshToken,
          name: 'Test Calendar',
          description: 'Test calendar description'
        }
      });
      
      // Create some test events
      await prisma.event.createMany({
        data: [
          {
            title: 'Test Event 1',
            description: 'Test event description',
            startTime: new Date('2025-01-01T10:00:00Z'),
            endTime: new Date('2025-01-01T11:00:00Z'),
            location: 'Test Location',
            calendarId: calendar.id,
            familyId: context.family.id,
            userId: context.user.id // Add the required userId field
          }
        ]
      });
    });

    it('should list Google calendars', async () => {
      const response: SuperTestResponse = await makeTestRequest(app, {
        method: 'GET',
        path: '/api/calendar/google/calendars',
        token: context.token
      });

      const data = await assertSuccessResponse(response);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].type).toBe('GOOGLE');
    });
  });

  describe('DELETE /api/calendar/google/calendars/:calendarId', () => {
    let calendarId: string;

    beforeEach(async () => {
      // Add a test calendar directly to database
      const prisma = getPrisma();
      const calendarData = generateTestCalendar(context.family.id);
      const calendar = await prisma.calendar.create({
        data: {
          ...calendarData,
          type: 'GOOGLE',
          familyId: context.family.id,
          googleCalendarId: 'test-calendar-id',
          accessToken: encryptedTokens.accessToken,
          refreshToken: encryptedTokens.refreshToken
        }
      });
      
      calendarId = calendar.id;
    });

    it('should remove a Google calendar', async () => {
      const response: SuperTestResponse = await makeTestRequest(app, {
        method: 'DELETE',
        path: `/api/calendar/google/calendars/${calendarId}`,
        token: context.token
      });

      const data = await assertSuccessResponse(response);
      expect(data.message).toBe('Calendar removed successfully');

      // Verify calendar is removed
      const getResponse: SuperTestResponse = await makeTestRequest(app, {
        method: 'GET',
        path: '/api/calendar/google/calendars',
        token: context.token
      });
      
      const listData = await assertSuccessResponse(getResponse);
      expect(listData.find((cal: any) => cal.id === calendarId)).toBeUndefined();
    });

    it('should not remove calendar without proper access', async () => {
      const outsiderResponse = await makeTestRequest(app, {
        method: 'DELETE',
        path: `/api/calendar/google/calendars/${calendarId}`,
        token: 'invalid-token'
      });

      expect(outsiderResponse.status).toBe(401);
    });
  });

  describe('POST /api/calendar/google/calendars/:calendarId/sync', () => {
    let calendarId: string;

    beforeEach(async () => {
      // Add a test calendar directly to database
      const prisma = getPrisma();
      const calendarData = generateTestCalendar(context.family.id);
      const calendar = await prisma.calendar.create({
        data: {
          ...calendarData,
          type: 'GOOGLE',
          familyId: context.family.id,
          googleCalendarId: 'test-calendar-id',
          accessToken: encryptedTokens.accessToken,
          refreshToken: encryptedTokens.refreshToken
        }
      });
      
      calendarId = calendar.id;
    });

    it('should sync a Google calendar', async () => {
      const response: SuperTestResponse = await makeTestRequest(app, {
        method: 'POST',
        path: `/api/calendar/google/calendars/${calendarId}/sync`,
        token: context.token
      });

      console.log('Sync Response:', response.body);
      const data = await assertSuccessResponse(response);
      expect(data.message).toBe('Calendar synced successfully');
    });

    it('should not sync calendar without proper access', async () => {
      const outsiderResponse = await makeTestRequest(app, {
        method: 'POST',
        path: `/api/calendar/google/calendars/${calendarId}/sync`,
        token: 'invalid-token'
      });

      expect(outsiderResponse.status).toBe(401);
    });
  });
});
