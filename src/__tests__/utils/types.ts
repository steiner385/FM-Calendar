import { User, Family, Event } from '@prisma/client';
import supertest from 'supertest';

export interface Variables {
  userId?: string;
  userRole?: string;
  googleCalendarService?: any;
  [key: string]: any; // Add index signature to satisfy Hono's Env constraint
}

export interface CalendarEnv {
  Variables: Variables;
}

declare module 'hono' {
  interface ContextVariableMap extends Variables {}
}

export interface TestAppOptions {
  enableLogging?: boolean;
  enableAuth?: boolean;
}

export interface BaseTestContext {
  user: User;
  family: Family;
  token: string;
  parentToken?: string;
  memberToken?: string;
  parentId?: string;
  memberId?: string;
  familyId?: string;
  eventId?: string;
  agent: supertest.SuperAgentTest;
  cleanup: () => Promise<void>;
}

export interface TestContext extends BaseTestContext {
  parentToken: string;
  memberToken: string;
  parentId: string;
  memberId: string;
  familyId: string;
  eventId: string;
}

export interface ExtendedTestContext extends TestContext {
  familyId: string;
  memberId: string;
  parentId: string;
  eventId: string;
}

export interface TestRequestOptions {
  method?: string;
  path: string;
  token?: string;
  userId?: string;
  userRole?: string;
  body?: any;
  headers?: Record<string, string>;
}

export interface EventResponse extends Event {
  calendar?: {
    id: string;
    name: string;
    type: string;
  };
  family?: {
    id: string;
    name: string;
  };
}
