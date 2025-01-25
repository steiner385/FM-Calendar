export * from './types';
export * from './errors';
export * from './controllers/EventController';
export { CalendarPlugin } from './CalendarPlugin';

// Create and export a default instance
import { CalendarPlugin } from './CalendarPlugin';
const calendarPlugin = new CalendarPlugin();
export default calendarPlugin;
