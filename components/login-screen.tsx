import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/app-screen-header';
import { useAuth } from '@/contexts/auth-context';

const LoginScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, isHydrated, isLoggedIn, isFirebaseReady } = useAuth();
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleGoSignUp = useCallback(() => {
    router.push('/sign-up');
  }, [router]);

  useEffect(() => {
    if (!isHydrated || !isLoggedIn) {
      return;
    }
    router.replace('/(tabs)');
  }, [isHydrated, isLoggedIn, router]);

  const handleSubmit = useCallback(async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace('/(tabs)');
  }, [email, password, router, signIn]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppScreenHeader title="LOG IN" onBack={handleBack} showWallet={false} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.intro, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
            Welcome back! Sign in with the email and password you used when you created your account.
          </Text>

          {!isFirebaseReady ? (
            <Text style={[styles.warnBanner, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
              Firebase is not configured. Add your EXPO_PUBLIC_FIREBASE_* keys from the Firebase console to a .env file
              and restart Expo to enable sign-in.
            </Text>
          ) : null}

          <View style={styles.field}>
            <Text style={[styles.label, titleFont, !fontsLoaded && styles.fontFallbackBold]} accessibilityRole="text">
              Email
            </Text>
            <TextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#A08B78"
              value={email}
              onChangeText={setEmail}
              style={[styles.input, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, titleFont, !fontsLoaded && styles.fontFallbackBold]} accessibilityRole="text">
              Password
            </Text>
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete="password"
              placeholder="••••••••"
              placeholderTextColor="#A08B78"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={[styles.input, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}
            />
          </View>

          {error ? (
            <Text style={[styles.errorText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            accessibilityState={{ disabled: submitting || !isFirebaseReady }}
            disabled={submitting || !isFirebaseReady}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
              (submitting || !isFirebaseReady) && styles.primaryBtnDisabled,
            ]}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.primaryBtnText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>SIGN IN</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to create account"
            onPress={handleGoSignUp}
            style={({ pressed }) => [styles.secondaryPress, pressed && styles.secondaryPressed]}>
            <Text style={[styles.secondaryText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
              New here? <Text style={styles.secondaryEm}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  intro: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 20,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  warnBanner: {
    backgroundColor: 'rgba(183, 28, 28, 0.85)',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFCDD2',
    padding: 12,
    marginBottom: 16,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFDE7',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#FFF8EF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E8D9C8',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#3E2723',
  },
  errorText: {
    color: '#FFCDD2',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#2A93F4',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#1B6ED4',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0D47A1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 4,
  },
  primaryBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryBtnDisabled: {
    opacity: 0.75,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  secondaryPress: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryPressed: {
    opacity: 0.85,
  },
  secondaryText: {
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  secondaryEm: {
    fontWeight: '900',
    textDecorationLine: 'underline',
    color: '#FFF59D',
  },
  fontFallbackBold: {
    fontWeight: '900',
  },
  fontFallbackSemi: {
    fontWeight: '600',
  },
});
