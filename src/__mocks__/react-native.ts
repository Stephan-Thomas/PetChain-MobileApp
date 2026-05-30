/**
 * Minimal React Native mock for Jest (node test environment).
 * Only stubs the APIs actually used in tested files.
 */
const Platform = {
  OS: 'ios' as const,
  select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
};

const Alert = {
  alert: jest.fn(),
};

const Dimensions = {
  get: jest.fn(() => ({ width: 375, height: 812 })),
};

module.exports = {
  Platform,
  Alert,
  Dimensions,
  StyleSheet: { create: (s: unknown) => s },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Image: 'Image',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  RefreshControl: 'RefreshControl',
};
