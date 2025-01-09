import { Context } from 'hono';
import { GoogleCalendarController } from '../../../controllers/GoogleCalendarController';
import { GoogleCalendarService } from '../../../services/GoogleCalendarService';
import { Event, GoogleCalendar, PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';

// Mock dependencies
jest.mock('../../../services/GoogleCalendarService');

const createMockContext = () => ({
  json: jest.fn(),
  get: jest.fn(),
  req: {
    json: jest.fn(),
    param: jest.fn(),
  },
});

describe('GoogleCalendarController', () => {
  let mockContext: ReturnType<typeof createMockContext>;
  let mockService: jest.Mocked<GoogleCalendarService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup context mock
    mockContext = createMockContext();

    // Create a complete mock of GoogleCalendarService
    const serviceMock = {
      prisma: {} as PrismaClient,
      oauth2Client: {} as OAuth2Client,
      getAccessRole: jest.fn(),
      addCalendar: jest.fn(),
      removeCalendar: jest.fn(),
      getCalendarList: jest.fn(),
      syncCalendar: jest.fn(),
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
    };

    // Setup service mock with complete implementation
    mockService = serviceMock as unknown as jest.Mocked<GoogleCalendarService>;

    // Replace service instance
    (GoogleCalendarController as any).calendarService = mockService;
  });

  describe('addCalendar', () => {
    const userId = 'user-123';
    const calendarId = 'calendar-123';
    const tokens = {
      access_token: 'access-123',
      refresh_token: 'refresh-123',
    };

    const mockCalendarResponse: GoogleCalendar = {
      id: 'cal-1',
      googleCalendarId: calendarId,
      name: 'Test Calendar',
      description: null,
      timezone: 'UTC',
      accessRole: 'reader',
      backgroundColor: null,
      foregroundColor: null,
      selected: true,
      primary: false,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncToken: null,
      nextSyncToken: null,
      lastSynced: null,
    };

    it('should add calendar successfully', async () => {
      // Setup mocks
      mockContext.get.mockReturnValue({ id: userId });
      mockContext.req.json.mockResolvedValue({ calendarId, tokens });
      mockService.addCalendar.mockResolvedValue(mockCalendarResponse);

      // Execute test
      await GoogleCalendarController.addCalendar(mockContext as unknown as Context);

      // Verify results
      expect(mockService.addCalendar).toHaveBeenCalledWith(userId, calendarId, tokens);
      expect(mockContext.json).toHaveBeenCalledWith(mockCalendarResponse, 201);
    });

    it('should handle missing parameters', async () => {
      // Setup mocks
      mockContext.get.mockReturnValue({ id: userId });
      mockContext.req.json.mockResolvedValue({});

      // Execute test
      await GoogleCalendarController.addCalendar(mockContext as unknown as Context);

      // Verify results
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Missing required parameters' },
        400
      );
    });

    it('should handle service errors', async () => {
      // Setup mocks
      mockContext.get.mockReturnValue({ id: userId });
      mockContext.req.json.mockResolvedValue({ calendarId, tokens });
      mockService.addCalendar.mockRejectedValue(new Error('Service error'));

      // Execute test
      await GoogleCalendarController.addCalendar(mockContext as unknown as Context);

      // Verify results
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Service error' },
        500
      );
    });
  });

  describe('syncCalendar', () => {
    const userId = 'user-123';
    const calendarId = 'calendar-123';

    it('should sync calendar successfully', async () => {
      // Setup mocks
      mockContext.get.mockReturnValue({ id: userId });
      mockContext.req.param.mockReturnValue(calendarId);
      mockService.syncCalendar.mockResolvedValue(undefined);

      // Execute test
      await GoogleCalendarController.syncCalendar(mockContext as unknown as Context);

      // Verify results
      expect(mockService.syncCalendar).toHaveBeenCalledWith(calendarId);
      expect(mockContext.json).toHaveBeenCalledWith(
        { message: 'Calendar synced successfully' }
      );
    });

    it('should handle missing parameters', async () => {
      // Setup mocks
      mockContext.get.mockReturnValue({ id: userId });
      mockContext.req.param.mockReturnValue(undefined);

      // Execute test
      await GoogleCalendarController.syncCalendar(mockContext as unknown as Context);

      // Verify results
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Missing required parameters' },
        400
      );
    });
  });

  describe('createEvent', () => {
    const userId = 'user-123';
    const calendarId = 'calendar-123';
    const eventData = {
      title: 'Test Event',
      startTime: new Date(),
      endTime: new Date(),
    };

    const mockEventResponse: Event = {
      id: 'event-1',
      title: eventData.title,
      description: null,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      location: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
      familyId: 'family-123',
      googleEventId: 'google-event-1',
      googleCalendarId: calendarId,
    };

    it('should create event successfully', async () => {
      // Setup mocks
      mockContext.get.mockReturnValue({ id: userId });
      mockContext.req.param.mockReturnValue(calendarId);
      mockContext.req.json.mockResolvedValue(eventData);
      mockService.createEvent.mockResolvedValue(mockEventResponse);

      // Execute test
      await GoogleCalendarController.createEvent(mockContext as unknown as Context);

      // Verify results
      expect(mockService.createEvent).toHaveBeenCalledWith(userId, calendarId, eventData);
      expect(mockContext.json).toHaveBeenCalledWith(mockEventResponse, 201);
    });

    it('should handle missing parameters', async () => {
      // Setup mocks
      mockContext.get.mockReturnValue({ id: userId });
      mockContext.req.param.mockReturnValue(undefined);
      mockContext.req.json.mockResolvedValue({});

      // Execute test
      await GoogleCalendarController.createEvent(mockContext as unknown as Context);

      // Verify results
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Missing required parameters' },
        400
      );
    });
  });

  describe('updateEvent', () => {
    const userId = 'user-123';
    const eventId = 'event-123';
    const updates = {
      title: 'Updated Event',
    };

    const mockEventResponse: Event = {
      id: eventId,
      title: updates.title,
      description: null,
      startTime: new Date(),
      endTime: new Date(),
      location: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
      familyId: 'family-123',
      googleEventId: 'google-event-1',
      googleCalendarId: 'calendar-123',
    };

    it('should update event successfully', async () => {
      // Setup mocks
      mockContext.get.mockReturnValue({ id: userId });
      mockContext.req.param.mockReturnValue(eventId);
      mockContext.req.json.mockResolvedValue(updates);
      mockService.updateEvent.mockResolvedValue(mockEventResponse);

      // Execute test
      await GoogleCalendarController.updateEvent(mockContext as unknown as Context);

      // Verify results
      expect(mockService.updateEvent).toHaveBeenCalledWith(userId, eventId, updates);
      expect(mockContext.json).toHaveBeenCalledWith(mockEventResponse, 200);
    });

    it('should handle missing parameters', async () => {
      // Setup mocks
      mockContext.get.mockReturnValue({ id: userId });
      mockContext.req.param.mockReturnValue(undefined);
      mockContext.req.json.mockResolvedValue({});

      // Execute test
      await GoogleCalendarController.updateEvent(mockContext as unknown as Context);

      // Verify results
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Missing required parameters' },
        400
      );
    });
  });

  describe('deleteEvent', () => {
    const userId = 'user-123';
    const eventId = 'event-123';

    it('should delete event successfully', async () => {
      // Setup mocks
      mockContext.get.mockReturnValue({ id: userId });
      mockContext.req.param.mockReturnValue(eventId);
      mockService.deleteEvent.mockResolvedValue(undefined);

      // Execute test
      await GoogleCalendarController.deleteEvent(mockContext as unknown as Context);

      // Verify results
      expect(mockService.deleteEvent).toHaveBeenCalledWith(userId, eventId);
      expect(mockContext.json).toHaveBeenCalledWith(
        { message: 'Event deleted successfully' }
      );
    });

    it('should handle missing parameters', async () => {
      // Setup mocks
      mockContext.get.mockReturnValue({ id: userId });
      mockContext.req.param.mockReturnValue(undefined);

      // Execute test
      await GoogleCalendarController.deleteEvent(mockContext as unknown as Context);

      // Verify results
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Missing required parameters' },
        400
      );
    });
  });
});
