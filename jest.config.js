/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: false,//true,
  coverageReporters: ["clover", "json", "lcov", "text", "json-summary"],
  coverageDirectory: "coverage",
  collectCoverageFrom: [
      "estuary-rpc*/**/*.{ts,js,jsx}"
  ],
  coveragePathIgnorePatterns: [
      "jest.config.js",
      "/node_modules/",
      ".*/dist/",
  ],
  modulePathIgnorePatterns: ["dist", ".*/dist"],
  // projects: ["<rootDir>/estuary-rpc", "<rootDir>/estuary-rpc-client", "<rootDir>/estuary-rpc-server"],
  moduleNameMapper: {
    'estuary-rpc': '../estuary-rpc/api'
}
};