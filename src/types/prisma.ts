import { Prisma } from '@prisma/client';

export type Event = Prisma.EventGetPayload<{}>;
export type Calendar = Prisma.CalendarGetPayload<{}>;
