# Calendar Module Test Utilities

This directory contains test utilities specific to the calendar module. These utilities help test calendar-related functionality including events, Google Calendar integration, and iCal support.

## File Organization

- `database.ts`: Calendar-specific database operations and setup
- `mock-data.ts`: Mock data generators for calendar tests
- `mock-google-calendar.ts`: Mock implementations for Google Calendar API
- `server.ts`: Server setup for calendar integration tests
- `setup.ts`: Calendar module test environment setup
- `test-helpers.ts`: Calendar-specific test helper functions
- `types.ts`: Type definitions for calendar tests

## Core vs Module-Specific Utilities

While core test utilities (in src/__tests__/utils/) handle general functionality like user and family management, these utilities focus on calendar-specific testing needs:

- Calendar data generation
- Google Calendar mocking
- iCal feed handling
- Event validation
- Calendar-specific server setup

## Usage

```typescript
// Import calendar-specific utilities
import { createMockCalendarData } from './utils/mock-data';
import { setupCalendarTest } from './utils/setup';

// Import core utilities when needed
import { createTestUser } from '../../../__tests__/utils/test-helpers';

describe('Calendar Tests', () => {
  it('should handle calendar operations', async () => {
    // Use both core and calendar-specific utilities
    const user = await createTestUser({ /* ... */ });
    const calendar = createMockCalendarData({ 
      userId: user.id,
      familyId: user.familyId
    });
  });
});
```

## Guidelines

1. Keep calendar-specific test utilities in this directory
2. Use core test utilities for general functionality
3. Follow the established patterns for:
   - Mock data generation
   - Test setup and teardown
   - Server configuration
   - Type definitions
