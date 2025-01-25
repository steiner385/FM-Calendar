export class CalendarError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CalendarError';
  }

  static NotFound(message = 'Calendar resource not found', details?: unknown) {
    return new CalendarError(message, 'CALENDAR_NOT_FOUND', 404, details);
  }

  static InvalidOperation(message: string, details?: unknown) {
    return new CalendarError(message, 'INVALID_OPERATION', 400, details);
  }

  static ValidationError(message: string, details?: unknown) {
    return new CalendarError(message, 'VALIDATION_ERROR', 400, details);
  }

  static AuthenticationError(message = 'Authentication required', details?: unknown) {
    return new CalendarError(message, 'AUTHENTICATION_ERROR', 401, details);
  }

  static AuthorizationError(message = 'Not authorized', details?: unknown) {
    return new CalendarError(message, 'AUTHORIZATION_ERROR', 403, details);
  }

  static SyncError(message: string, details?: unknown) {
    return new CalendarError(message, 'SYNC_ERROR', 500, details);
  }

  static ConfigurationError(message: string, details?: unknown) {
    return new CalendarError(message, 'CONFIGURATION_ERROR', 500, details);
  }
}
