# FM-Calendar Plugin

A calendar management plugin for FamilyManager that provides calendar and event management capabilities with Google Calendar and iCal support.

## Features

- Event management (create, read, update, delete)
- Family-specific calendar views
- Integration with tasks and shopping schedules
- Google Calendar synchronization
- iCal support
- Real-time metrics and health monitoring

## Installation

```bash
npm install fm-calendar
```

## Usage

```typescript
import { CalendarPlugin } from 'fm-calendar';

// Create a new instance
const calendar = new CalendarPlugin();

// Initialize the plugin
await calendar.init();

// Start the plugin
await calendar.start();

// Get plugin routes
const routes = calendar.getRoutes();

// Check plugin health
const health = await calendar.getHealth();

// Stop the plugin when done
await calendar.stop();
```

## API Routes

- `GET /api/calendar/events` - List all events
- `POST /api/calendar/events` - Create a new event
- `GET /api/calendar/events/:id` - Get event by ID
- `PUT /api/calendar/events/:id` - Update an event
- `DELETE /api/calendar/events/:id` - Delete an event
- `GET /api/calendar/events/family/:familyId` - List events by family

## Configuration

The plugin accepts the following configuration options:

```typescript
{
  maxEventsPerCalendar: number; // Maximum events per calendar (default: 1000)
  defaultCalendarId?: string;   // Default calendar ID (optional)
  syncInterval: number;         // Sync interval in seconds (default: 300)
  notifyOnEventCreation: boolean; // Notify on event creation (default: true)
  notifyOnEventUpdate: boolean;   // Notify on event update (default: true)
}
```

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Build the plugin
npm run build

# Run tests
npm test
```

## License

MIT
