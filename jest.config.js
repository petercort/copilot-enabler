/** @type {import('jest').Config} */
export const preset = 'ts-jest';
export const testEnvironment = 'node';
export const roots = ['<rootDir>/src'];
export const testMatch = ['**/*.test.ts'];
export const moduleFileExtensions = ['ts', 'js', 'json'];
export const collectCoverageFrom = ['src/**/*.ts', '!src/test/**', '!src/**/*.test.ts'];
