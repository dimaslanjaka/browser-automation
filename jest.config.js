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
    // Use babel-jest for .js/.jsx/.ts/.tsx
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  transformIgnorePatterns: ['/node_modules/(?!(@react|react|react-dom|react-router-dom)/)'],
  modulePathIgnorePatterns: ['<rootDir>/packages']
};
