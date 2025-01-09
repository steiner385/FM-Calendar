import { generateToken } from '../../utils/auth';
import { getPrisma } from './database';
import { TestContext } from './types';
import { createTestApp, closeServer } from './server';
import { cleanupTestData } from './database';
import supertest from 'supertest';
import { UserRole } from '../../../../types/user-role';
import http from 'http';
import { createServerHandler } from './server';

// Test data helpers
export async function createTestUser(data: {
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  familyId?: string;
  password?: string;
  username?: string;
}) {
  const timestamp = Date.now();
  const prisma = getPrisma();
  const user = await prisma.user.create({
    data: {
      ...data,
      password: data.password || 'test-password',
      username: data.username || `test_${timestamp}`,
      updatedAt: new Date()
    }
  });

  const token = await generateToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  return { user, token };
}

export async function createTestFamily(name: string = 'Test Family') {
  const prisma = getPrisma();
  return prisma.family.create({
    data: {
      name,
      updatedAt: new Date()
    }
  });
}

export async function createOtherFamilyContext(role: string = 'PARENT'): Promise<TestContext> {
  const timestamp = Date.now();
  const baseCtx = await setupTestContext();
  
  // Create new family
  const family = await getPrisma().family.create({
    data: {
      name: `Other Family ${timestamp}`,
      updatedAt: new Date()
    }
  });

  // Create new user
  const user = await getPrisma().user.create({
    data: {
      email: `other_${timestamp}@example.com`,
      password: 'test-password',
      firstName: 'Other',
      lastName: 'User',
      username: `other_${timestamp}`,
      role: role,
      familyId: family.id,
      updatedAt: new Date()
    }
  });

  const token = await generateToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  return {
    ...baseCtx,
    user,
    family,
    token,
    familyId: family.id,
    parentToken: token,
    memberToken: '',
    parentId: user.id,
    memberId: '',
    eventId: '',
    cleanup: baseCtx.cleanup
  };
}

let serverInstance: http.Server | null = null;

export async function setupTestContext(): Promise<TestContext> {
  try {
    // Ensure any existing server is properly closed
    await closeServer();
    
    const timestamp = Date.now();
    const prisma = getPrisma();
    const app = createTestApp({ enableAuth: true });

    // Create a new server with a random port
    const port = Math.floor(Math.random() * (65535 - 1024) + 1024);
    serverInstance = http.createServer(createServerHandler(app));
    await new Promise<void>((resolve) => {
      serverInstance!.listen(port, () => resolve());
    });

    const agent = supertest(`http://localhost:${port}`) as any;

    // Create family and user in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: {
          name: `Test Family ${timestamp}`,
          updatedAt: new Date()
        }
      });

      const user = await tx.user.create({
        data: {
          email: `test_${timestamp}@example.com`,
          role: UserRole.PARENT,
          firstName: 'Test',
          lastName: 'User',
          username: `test_${timestamp}`,
          password: 'test-password',
          familyId: family.id,
          updatedAt: new Date()
        },
        include: {
          family: true
        }
      });

      return { family, user };
    });

    const { family, user } = result;
    
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return {
      user,
      family,
      token,
      familyId: family.id,
      parentId: user.id,
      parentToken: token,
      memberToken: '',
      memberId: '',
      eventId: '',
      agent,
      cleanup: async () => {
        try {
          await closeServer();
          await cleanupTestData();
        } catch (error) {
          console.warn('[Test Context] Cleanup warning:', error);
        }
      }
    };
  } catch (error) {
    console.error('[Test Context] Setup failed:', error);
    await closeServer();
    await cleanupTestData();
    throw error;
  }
}

export const cleanup = {
  database: cleanupTestData,
  server: closeServer,
  processListeners: () => {
    return Promise.resolve();
  }
};
