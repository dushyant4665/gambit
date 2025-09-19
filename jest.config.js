module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/server/tests'],
  testMatch: ['***.js',
    '!server/dist*.d.ts',
  ],
  verbose: true
}
