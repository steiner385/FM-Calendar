import { Hono } from 'hono';
import { serve, type ServerType } from '@hono/node-server';
import http, { RequestListener } from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import supertest from 'supertest';
import { verifyToken } from '../../utils/auth';
import calendarRouter from '../../routes';
import { CalendarEnv, TestAppOptions, TestRequestOptions } from './types';
import { Readable } from 'stream';
import { getPrisma } from './database';
import { setupGoogleCalendarMocks } from './mock-google-calendar';

// Server instance management
let serverInstance: http.Server | null = null;

// Test app setup
export function createTestApp(options: TestAppOptions = {}): Hono<CalendarEnv> {
  const app = new Hono<CalendarEnv>();
  app.route('/api/calendar', calendarRouter);
  setupGoogleCalendarMocks(); // Set up Google Calendar mocks for each test app instance

  if (options.enableLogging) {
    app.use('*', async (c, next) => {
      console.log(`[Test App] ${c.req.method} ${c.req.path}`);
      console.log('[Test App] Headers:', c.req.header());
      await next();
    });
  }

  if (options.enableAuth !== false) {
    app.use('*', async (c, next) => {
      const userId = c.req.header('X-User-Id');
      const userRole = c.req.header('X-User-Role');
      const authHeader = c.req.header('Authorization');

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = await verifyToken(token);
          const prisma = getPrisma();
          const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { family: true }
          });
          if (user) {
            c.set('user', user);
            c.set('userId', decoded.userId);
            c.set('userRole', decoded.role);
            c.set('Variables', { userId: decoded.userId, userRole: decoded.role });
          }
        } catch (error) {
          console.error('[Test App] Token verification failed:', error);
          return c.json({ success: false, error: 'Unauthorized' }, 401);
        }
      } else if (userId && userRole) {
        c.set('userId', userId);
        c.set('userRole', userRole);
        c.set('Variables', { userId, userRole });
      } else {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
      }

      await next();
    });
  }

  return app;
}

// Helper function to convert IncomingMessage to string
async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

// Create a server handler that adapts Hono's handler to Node's HTTP server
export function createServerHandler(app: Hono<CalendarEnv>): RequestListener {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      // Get the request body if it exists
      let body: string | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = await streamToString(req);
      }

      // Create the request object
      const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
        method: req.method,
        headers: req.headers as HeadersInit,
        body: body ? body : undefined,
      });

      // Handle the request
      const response = await app.fetch(request);
      
      // Write status and headers
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      // Write body
      const responseBody = await response.text();
      res.end(responseBody);
    } catch (error: unknown) {
      console.error('Server handler error:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal Server Error'
        }
      }));
    }
  };
}

export async function closeServer(): Promise<void> {
  if (serverInstance) {
    // Force close all connections
    serverInstance.unref();
    
    // Close the server
    await new Promise<void>((resolve, reject) => {
      serverInstance!.close((err) => {
        if (err) {
          console.error('Error closing server:', err);
          reject(err);
          return;
        }
        serverInstance = null;
        resolve();
      });

      // Force close after timeout
      setTimeout(() => {
        if (serverInstance) {
          serverInstance.closeAllConnections();
          serverInstance = null;
          resolve();
        }
      }, 1000);
    });
  }
}

export async function makeTestRequest(
  app: Hono<CalendarEnv>,
  options: TestRequestOptions
): Promise<supertest.Response> {
  try {
    // Close any existing server and wait for cleanup
    await closeServer();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create a new server with a random port
    serverInstance = http.createServer(createServerHandler(app));
    const port = Math.floor(Math.random() * (65535 - 1024) + 1024);
    
    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      serverInstance!.once('error', reject);
      serverInstance!.listen(port, () => {
        serverInstance!.removeListener('error', reject);
        resolve();
      });
    });

    const agent = supertest(`http://localhost:${port}`);
    let request = agent.get(options.path);
    
    if (options.method) {
      switch (options.method.toLowerCase()) {
        case 'post':
          request = agent.post(options.path);
          break;
        case 'put':
          request = agent.put(options.path);
          break;
        case 'delete':
          request = agent.delete(options.path);
          break;
        case 'patch':
          request = agent.patch(options.path);
          break;
      }
    }

    if (options.token) {
      request.set('Authorization', `Bearer ${options.token}`);
    }

    if (options.headers) {
      request.set(options.headers);
    }

    if (options.body) {
      request.send(options.body);
    }

    return request;
  } catch (error) {
    console.error('[Test Request] Failed:', error);
    throw error;
  }
}

export async function assertSuccessResponse(response: supertest.Response, status = 200) {
  expect(response.status).toBe(status);
  expect(response.body).toHaveProperty('success', true);
  if (response.body.data) {
    return response.body.data;  // Return data if it exists
  }
  return response.body;  // Return full body if no data property
}

export async function assertErrorResponse(
  response: supertest.Response, 
  status: number,
  errorCode: string
) {
  expect(response.status).toBe(status);
  expect(response.body).toHaveProperty('success', false);
  expect(response.body.error).toHaveProperty('code', errorCode);
  return response.body.error;
}
