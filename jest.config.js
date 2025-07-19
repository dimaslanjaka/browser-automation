export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    // Use babel-jest for .js/.jsx/.ts/.tsx
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  transformIgnorePatterns: ['/node_modules/(?!(@react|react|react-dom|react-router-dom)/)']
};
