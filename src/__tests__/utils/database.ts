import { PrismaClient, Prisma } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';
import { EventBus } from '../../../../core/events/EventBus';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'file:./test.db';

// Prisma setup
let prismaInstance: PrismaClient | null = null;

function getTestDatabaseConfig(): Prisma.PrismaClientOptions {
  return {
    datasources: {
      db: {
        url: TEST_DATABASE_URL
      }
    },
    log: process.env.DEBUG ? ['query', 'error', 'warn'] as Prisma.LogLevel[] : ['error'] as Prisma.LogLevel[]
  };
}

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient(getTestDatabaseConfig());
  }
  return prismaInstance;
}

export type { Prisma };

async function resetPrismaConnection() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

// Database initialization
export async function initializeTestDb() {
  try {
    const prisma = getPrisma();
    await prisma.$disconnect();

    const testDbPath = './test.db';
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db'
      }
    });

    await prisma.$connect();
    return true;
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
}

// Initialize schema when module loads
initializeTestDb().catch(console.error);

// Database management
let isConnected = false;

async function ensureConnection() {
  if (!isConnected) {
    const prisma = getPrisma();
    await prisma.$connect();
    isConnected = true;
  }
}

export async function disconnect() {
  if (isConnected) {
    const prisma = getPrisma();
    await prisma.$disconnect();
    isConnected = false;
  }
}

export async function setupTestDb() {
  try {
    await resetPrismaConnection();
    
    const testDbPath = './test.db';
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db'
      }
    });

    prismaInstance = getPrisma();
    await prismaInstance.$connect();
    
    return prismaInstance;
  } catch (error) {
    console.error('Test database setup failed:', error);
    throw error;
  }
}

export async function cleanupTestData(preserveContext?: boolean) {
  const prisma = getPrisma();
  try {
    // Clear event bus subscribers
    EventBus.getInstance().clearAllSubscribers();
    
    // Delete in correct order using transactions
    await prisma.$transaction([
      // First delete events (they depend on calendars)
      prisma.event.deleteMany(),
      // Then delete calendars (they depend on families)
      prisma.calendar.deleteMany(),
      // Only if not preserving context:
      ...(preserveContext ? [] : [
        // Delete users (they depend on families)
        prisma.user.deleteMany(),
        // Finally delete families
        prisma.family.deleteMany()
      ])
    ]);
  } catch (error) {
    console.warn('Cleanup warning:', error);
    await resetPrismaConnection();
  }
}
