// Mock for @sentry/react-native used in Jest tests
const mockTransaction = {
  setStatus: jest.fn(),
  finish: jest.fn(),
};

const mockScope = {
  setExtras: jest.fn(),
  setSpan: jest.fn(),
};

const mockHub = {
  configureScope: jest.fn((cb: (scope: typeof mockScope) => void) => cb(mockScope)),
};

const Sentry = {
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn((cb: (scope: typeof mockScope) => void) => cb(mockScope)),
  startTransaction: jest.fn(() => mockTransaction),
  getCurrentHub: jest.fn(() => mockHub),
  wrap: jest.fn((component: unknown) => component),
  ErrorBoundary: jest.fn(({ children }: { children: React.ReactNode }) => children),
};

export default Sentry;
export const {
  init,
  captureException,
  captureMessage,
  setUser,
  setContext,
  addBreadcrumb,
  withScope,
  startTransaction,
  getCurrentHub,
  wrap,
  ErrorBoundary,
} = Sentry;

// Re-export mock references for test assertions
export { mockTransaction, mockScope, mockHub };
