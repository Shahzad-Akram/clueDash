import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { Image } from 'expo-image';
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
import { useAuth, type Gender } from '@/contexts/auth-context';
import { PROFILE_AVATARS } from '@/lib/profile-avatars';
import type { ProfileAvatarId } from '@/lib/profile-avatars';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

const SignUpScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, isHydrated, isLoggedIn, isFirebaseReady } = useAuth();
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('prefer_not');
  const [avatarId, setAvatarId] = useState<ProfileAvatarId>('user1');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleGoLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

  useEffect(() => {
    if (!isHydrated || !isLoggedIn) {
      return;
    }
    router.replace('/');
  }, [isHydrated, isLoggedIn, router]);

  const handleAvatarSelect = useCallback((id: ProfileAvatarId) => {
    setAvatarId(id);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const result = await signUp({
      email: email.trim(),
      password,
      name: name.trim(),
      age: age.trim(),
      gender,
      avatarId,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace('/');
  }, [age, avatarId, confirmPassword, email, gender, name, password, router, signUp]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppScreenHeader title="SIGN UP" onBack={handleBack} showWallet={false} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.intro, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
            Create your profile. You can use these avatars from the game art set.
          </Text>

          {!isFirebaseReady ? (
            <Text style={[styles.warnBanner, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
              Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* to .env and restart Expo before creating an account.
            </Text>
          ) : null}

          <View style={styles.field}>
            <Text style={[styles.label, titleFont, !fontsLoaded && styles.fontFallbackBold]}>Email</Text>
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
            <Text style={[styles.label, titleFont, !fontsLoaded && styles.fontFallbackBold]}>Name</Text>
            <TextInput
              accessibilityLabel="Display name"
              autoComplete="name"
              placeholder="Your name"
              placeholderTextColor="#A08B78"
              value={name}
              onChangeText={setName}
              style={[styles.input, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, titleFont, !fontsLoaded && styles.fontFallbackBold]}>Age</Text>
            <TextInput
              accessibilityLabel="Age"
              keyboardType="number-pad"
              placeholder="e.g. 21"
              placeholderTextColor="#A08B78"
              maxLength={3}
              value={age}
              onChangeText={setAge}
              style={[styles.input, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, titleFont, !fontsLoaded && styles.fontFallbackBold]}>Gender</Text>
            <View style={styles.genderRow} accessibilityRole="radiogroup" accessibilityLabel="Gender">
              {GENDER_OPTIONS.map((opt) => {
                const selected = gender === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={opt.label}
                    onPress={() => setGender(opt.value)}
                    style={({ pressed }) => [
                      styles.genderPill,
                      selected && styles.genderPillSelected,
                      pressed && styles.genderPillPressed,
                    ]}>
                    <Text
                      style={[
                        styles.genderPillText,
                        selected && styles.genderPillTextSelected,
                        bodyFont,
                        !fontsLoaded && styles.fontFallbackSemi,
                      ]}
                      numberOfLines={1}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, titleFont, !fontsLoaded && styles.fontFallbackBold]}>Profile picture</Text>
            <View style={styles.avatarRow}>
              {PROFILE_AVATARS.map((a) => {
                const selected = avatarId === a.id;
                return (
                  <Pressable
                    key={a.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={a.accessibilityLabel}
                    onPress={() => handleAvatarSelect(a.id)}
                    style={({ pressed }) => [
                      styles.avatarOuter,
                      selected && styles.avatarOuterSelected,
                      pressed && styles.avatarPressed,
                    ]}>
                    <Image source={a.source} style={styles.avatarImage} contentFit="cover" />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, titleFont, !fontsLoaded && styles.fontFallbackBold]}>Password</Text>
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete="password-new"
              placeholder="At least 6 characters"
              placeholderTextColor="#A08B78"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={[styles.input, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, titleFont, !fontsLoaded && styles.fontFallbackBold]}>Confirm password</Text>
            <TextInput
              accessibilityLabel="Confirm password"
              autoCapitalize="none"
              autoComplete="password-new"
              placeholder="Repeat password"
              placeholderTextColor="#A08B78"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
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
            accessibilityLabel="Create account"
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
              <Text style={[styles.primaryBtnText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>CREATE ACCOUNT</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to sign in"
            onPress={handleGoLogin}
            style={({ pressed }) => [styles.secondaryPress, pressed && styles.secondaryPressed]}>
            <Text style={[styles.secondaryText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
              Already have an account? <Text style={styles.secondaryEm}>Log in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignUpScreen;

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
    marginBottom: 18,
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
    marginBottom: 14,
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
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderPill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFF8EF',
    borderWidth: 2,
    borderColor: '#E8D9C8',
  },
  genderPillSelected: {
    backgroundColor: '#2A93F4',
    borderColor: '#1B6ED4',
  },
  genderPillPressed: {
    opacity: 0.9,
  },
  genderPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5D4037',
  },
  genderPillTextSelected: {
    color: '#FFFFFF',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  avatarOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 3,
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: '#FFF8EF',
  },
  avatarOuterSelected: {
    borderColor: '#2A93F4',
    backgroundColor: '#E3F2FD',
  },
  avatarPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  errorText: {
    color: '#FFCDD2',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#72BE2C',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#4E961B',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#33691E',
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
    letterSpacing: 0.6,
  },
  secondaryPress: {
    marginTop: 18,
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
