# FM-Calendar Module

## Overview
FM-Calendar is a FamilyManager module that provides comprehensive calendar and event management capabilities. Built on the FamilyManager SDK, it offers seamless integration with Google Calendar and iCal, along with robust event management features for families.

## Features

### Backend Features
- Event management (CRUD operations)
- Google Calendar synchronization
- iCal support and export
- Family calendar management
- Recurring events
- Event notifications
- Real-time updates

### Frontend Components
- Calendar views (month, week, day)
- Event creation/editing forms
- Calendar settings panel
- Event details modal
- Calendar sharing interface
- Notification preferences
- Integration widgets

## Installation

```bash
npm install @familymanager/calendar --save
```

## Usage

### Backend Integration

```typescript
import { CalendarModule } from '@familymanager/calendar';
import { ModuleContext } from '@familymanager/sdk';

export class Calendar extends CalendarModule {
  async initialize(context: ModuleContext): Promise<void> {
    // Initialize module
    await this.setupDatabase();
    await this.registerRoutes();
    await this.setupGoogleCalendarSync();
    this.setupEventHandlers();
  }
}
```

### Frontend Components

```typescript
import { 
  CalendarView,
  EventForm,
  CalendarSettings 
} from '@familymanager/calendar/components';

function CalendarPage() {
  return (
    <div>
      <CalendarView />
      <EventForm />
      <CalendarSettings />
    </div>
  );
}
```

### Event Handling

```typescript
import { useEventListener } from '@familymanager/sdk';

function CalendarComponent() {
  useEventListener('calendar:event-created', (data) => {
    // Handle new event
  });
}
```

## API Reference

### REST Endpoints

#### Events
- `GET /api/calendar/events`: List all events
- `POST /api/calendar/events`: Create new event
- `GET /api/calendar/events/:id`: Get event details
- `PUT /api/calendar/events/:id`: Update event
- `DELETE /api/calendar/events/:id`: Delete event
- `GET /api/calendar/events/family/:familyId`: List family events

#### Calendar Settings
- `GET /api/calendar/settings`: Get calendar settings
- `PUT /api/calendar/settings`: Update settings
- `POST /api/calendar/sync`: Trigger sync
- `GET /api/calendar/export/:id`: Export calendar

### Events

#### Emitted Events
- `calendar:event-created`
- `calendar:event-updated`
- `calendar:event-deleted`
- `calendar:sync-completed`

#### Handled Events
- `family:member-added`
- `family:member-removed`
- `tasks:due-date-changed`

## Database Schema

```prisma
model Calendar {
  id          String   @id @default(uuid())
  name        String
  familyId    String
  color       String?
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  events      Event[]
}

model Event {
  id          String   @id @default(uuid())
  calendarId  String
  title       String
  description String?
  startTime   DateTime
  endTime     DateTime
  location    String?
  isRecurring Boolean  @default(false)
  recurrence  Json?
  calendar    Calendar @relation(fields: [calendarId], references: [id])
}

model CalendarSync {
  id            String   @id @default(uuid())
  calendarId    String
  provider      String
  lastSyncTime  DateTime
  syncToken     String?
  settings      Json
}
```

## Configuration

```typescript
interface CalendarConfig {
  maxEventsPerCalendar: number;    // Default: 1000
  defaultCalendarId?: string;      // Optional default calendar
  syncInterval: number;            // Sync interval in seconds (default: 300)
  notifyOnEventCreation: boolean;  // Default: true
  notifyOnEventUpdate: boolean;    // Default: true
  googleCalendar?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
}
```

## Testing

### Unit Tests
```bash
# Run unit tests
npm run test:unit

# Run with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

### Test Utilities

```typescript
import { 
  createTestCalendar,
  createTestEvent,
  mockCalendarModule 
} from '@familymanager/calendar/testing';

describe('Calendar Tests', () => {
  const mockModule = mockCalendarModule();
  
  it('handles events', async () => {
    const calendar = await createTestCalendar();
    const event = await createTestEvent(calendar.id);
    // Test implementation
  });
});
```

## Development

### Prerequisites
- Node.js 18+
- FamilyManager SDK
- PostgreSQL
- Google Calendar API credentials (optional)

### Setup
```bash
# Install dependencies
npm install

# Set up database
npm run db:setup

# Run migrations
npm run db:migrate

# Start development server
npm run dev
```

### Building
```bash
# Build module
npm run build

# Generate documentation
npm run docs
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your contributions:
- Follow the existing code style
- Include appropriate tests
- Update relevant documentation
- Consider backward compatibility

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Dependencies

### Required
- @familymanager/sdk: Core SDK
- @prisma/client: Database ORM
- react: Frontend framework
- redux: State management
- googleapis: Google Calendar API
- ical.js: iCal support

### Development
- typescript: Type checking
- jest: Testing framework
- playwright: E2E testing
- eslint: Code linting
- prettier: Code formatting

## Support

- [Issue Tracker](https://github.com/familymanager/calendar/issues)
- [Documentation](./docs)
- [Discussions](https://github.com/familymanager/calendar/discussions)
