/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@repositories/(.*)$': '<rootDir>/src/repositories/$1',
    '^@errors/(.*)$': '<rootDir>/src/errors/$1',
    '^@google/(.*)$': '<rootDir>/src/google/$1',
    '^@ical/(.*)$': '<rootDir>/src/ical/$1',
    '^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
    '^@validators/(.*)$': '<rootDir>/src/validators/$1',
    '^@events/(.*)$': '<rootDir>/src/events/$1',
    '^@factories/(.*)$': '<rootDir>/src/factories/$1',
    '^@mappers/(.*)$': '<rootDir>/src/mappers/$1'
  }
};
