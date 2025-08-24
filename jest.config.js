/**
 * @type {import('jest').Config}
 * Jest configuration for browser-automation project.
 */
export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/test'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    // Use ts-jest for .ts files only
    '^.+\\.ts$': 'ts-jest',
    // Use babel-jest for .tsx, .jsx, .js, .mjs, .cjs files
    '^.+\\.(tsx|jsx|js|mjs|cjs)$': 'babel-jest'
  },
  transformIgnorePatterns: ['/node_modules/(?!(@react|react|react-dom|react-router-dom)/)'],
  modulePathIgnorePatterns: ['<rootDir>/packages']
};
