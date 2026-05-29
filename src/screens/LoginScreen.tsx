import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  clearBiometricFallbackPreference,
  isBiometricAuthenticationAvailable,
  isBiometricAuthenticationEnabled,
  login,
  loginWithBiometricOrFallback,
  promptForBiometricSetup,
  shouldPromptBiometricSetup,
  verifyPin,
  type AuthSession,
  type BiometricFallbackReason,
} from '../services/authService';
import { isValidEmail } from '../utils/validators';

interface Props {
  onSuccess: (session: AuthSession) => void;
  onRegister: () => void;
  onForgotPassword: () => void;
}

type AuthMode = 'password' | 'biometric' | 'pin';

const FALLBACK_REASON_MSG: Record<BiometricFallbackReason, string> = {
  unavailable: 'Biometric authentication is not available on this device.',
  max_attempts_reached: 'Too many failed biometric attempts. Please use your PIN.',
  user_preference: 'Using PIN login.',
};

const LoginScreen: React.FC<Props> = ({ onSuccess, onRegister, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [showBiometricSetupPrompt, setShowBiometricSetupPrompt] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const pinRef = useRef<TextInput>(null);

  useEffect(() => {
    void (async () => {
      const [available, enabled] = await Promise.all([
        isBiometricAuthenticationAvailable(),
        isBiometricAuthenticationEnabled(),
      ]);
      setBiometricAvailable(available);
      setBiometricEnabled(enabled);
      if (available && enabled) {
        setAuthMode('biometric');
        void handleBiometricLogin();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBiometricLogin = async () => {
    setLoading(true);
    setFallbackReason(null);
    try {
      const result = await loginWithBiometricOrFallback();
      if (result.success && result.session) {
        onSuccess({ user: { id: '', email: '', name: '' }, ...result.session });
        return;
      }
      if (result.fallbackRequired) {
        const msg = result.fallbackReason ? FALLBACK_REASON_MSG[result.fallbackReason] : null;
        setFallbackReason(msg);
        setAuthMode('pin');
      }
    } catch {
      setAuthMode('password');
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async () => {
    if (!pin || pin.length < 4) {
      Alert.alert('Validation', 'PIN must be at least 4 digits.');
      return;
    }
    setLoading(true);
    try {
      const valid = await verifyPin(pin);
      if (!valid) {
        Alert.alert('PIN Login', 'Incorrect PIN. Please try again.');
        setPin('');
        return;
      }
      // After successful PIN login, check if we should re-prompt biometric setup
      const shouldPrompt = await shouldPromptBiometricSetup();
      if (shouldPrompt) {
        setShowBiometricSetupPrompt(true);
      } else {
        // PIN login doesn't have a full session — fall back to password
        Alert.alert('PIN Verified', 'Please enter your password to complete login.');
        setAuthMode('password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Validation', 'Email and password are required.');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Validation', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const session = await login(email.trim(), password);
      onSuccess(session);
    } catch (err: unknown) {
      Alert.alert('Login Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReEnableBiometrics = async () => {
    const ok = await promptForBiometricSetup();
    if (ok) {
      await clearBiometricFallbackPreference();
      setBiometricEnabled(true);
      Alert.alert('Biometrics Enabled', 'Biometric login has been re-enabled.');
    }
    setShowBiometricSetupPrompt(false);
    setAuthMode('password');
  };

  if (showBiometricSetupPrompt) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.logo}>🐾</Text>
          <Text style={styles.title}>Re-enable Biometrics?</Text>
          <Text style={styles.subtitle}>
            Would you like to re-enable Face ID / fingerprint for faster login?
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => void handleReEnableBiometrics()}>
            <Text style={styles.btnText}>Yes, enable biometrics</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => { setShowBiometricSetupPrompt(false); setAuthMode('password'); }}
          >
            <Text style={styles.btnTextSecondary}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>🐾</Text>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to PetChain</Text>

        {fallbackReason && (
          <View style={styles.fallbackBanner}>
            <Text style={styles.fallbackText}>{fallbackReason}</Text>
          </View>
        )}

        {authMode === 'biometric' && (
          <View style={styles.biometricContainer}>
            <Text style={styles.biometricIcon}>🔐</Text>
            <Text style={styles.biometricLabel}>Authenticating with biometrics…</Text>
            {loading && <ActivityIndicator color="#4CAF50" style={{ marginTop: 12 }} />}
            <TouchableOpacity
              style={styles.fallbackLink}
              onPress={() => { setAuthMode('pin'); setFallbackReason('Using PIN login.'); }}
            >
              <Text style={styles.link}>Use PIN instead</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fallbackLink}
              onPress={() => setAuthMode('password')}
            >
              <Text style={styles.link}>Use password instead</Text>
            </TouchableOpacity>
          </View>
        )}

        {authMode === 'pin' && (
          <>
            <TextInput
              ref={pinRef}
              style={styles.input}
              placeholder="Enter PIN"
              placeholderTextColor="#aaa"
              secureTextEntry
              keyboardType="numeric"
              maxLength={8}
              value={pin}
              onChangeText={setPin}
              returnKeyType="go"
              onSubmitEditing={() => void handlePinLogin()}
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={() => void handlePinLogin()}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In with PIN</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.fallbackLink} onPress={() => setAuthMode('password')}>
              <Text style={styles.link}>Use password instead</Text>
            </TouchableOpacity>
          </>
        )}

        {authMode === 'password' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#aaa"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              ref={passwordRef}
              returnKeyType="go"
              onSubmitEditing={() => void handlePasswordLogin()}
            />
            <TouchableOpacity onPress={onForgotPassword} style={styles.forgotLink}>
              <Text style={styles.link}>Forgot password?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={() => void handlePasswordLogin()}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
            </TouchableOpacity>
            {biometricAvailable && biometricEnabled && (
              <TouchableOpacity
                style={styles.fallbackLink}
                onPress={() => { setAuthMode('biometric'); void handleBiometricLogin(); }}
              >
                <Text style={styles.link}>Use biometrics instead</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={onRegister}>
            <Text style={styles.link}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', color: '#1a1a1a' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 32 },
  fallbackBanner: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFCA28',
  },
  fallbackText: { color: '#7B4F00', fontSize: 13, textAlign: 'center' },
  biometricContainer: { alignItems: 'center', marginBottom: 24 },
  biometricIcon: { fontSize: 48, marginBottom: 8 },
  biometricLabel: { fontSize: 16, color: '#333', marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
    color: '#1a1a1a',
  },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 20 },
  fallbackLink: { alignSelf: 'center', marginTop: 12 },
  btn: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnSecondary: { backgroundColor: '#e0e0e0' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnTextSecondary: { color: '#333', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { color: '#666', fontSize: 14 },
  link: { color: '#4CAF50', fontWeight: '600', fontSize: 14 },
});
