import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Only test pure utility files — skip anything importing React Native
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/build/'],
};

export default config;