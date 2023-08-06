/** @type {import('ts-jest').JestConfigWithTsJest} */

export default {
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.(mt|t|cj|j)s$": [
      "ts-jest",
      {
        "useESM": true
      }
    ]
  },
  resolver: "ts-jest-resolver",
  testEnvironment: 'node',
};