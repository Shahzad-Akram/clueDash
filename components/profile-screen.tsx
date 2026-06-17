import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/app-screen-header';
import { useAuth } from '@/contexts/auth-context';
import { hasPrivacyPolicyUrl, openPrivacyPolicy } from '@/lib/legal-links';
import { getProfileAvatarSource } from '@/lib/profile-avatars';

const ProfileScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isHydrated, isLoggedIn, signOut, deleteAccount } = useAuth();
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (!isLoggedIn) {
      router.replace('/');
    }
  }, [isHydrated, isLoggedIn, router]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace('/');
  }, [router, signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your profile, points, and game progress. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeleting(true);
              const result = await deleteAccount();
              setDeleting(false);
              if (!result.ok) {
                Alert.alert('Could not delete account', result.message);
                return;
              }
              router.replace('/');
            })();
          },
        },
      ],
    );
  }, [deleteAccount, router]);

  const handlePrivacyPress = useCallback(() => {
    void openPrivacyPolicy();
  }, []);

  if (!isHydrated || !user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <AppScreenHeader title="PROFILE" onBack={handleBack} showWallet={false} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppScreenHeader title="PROFILE" onBack={handleBack} showWallet={false} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Image source={getProfileAvatarSource(user.avatarId)} style={styles.avatar} contentFit="cover" accessibilityLabel="Your avatar" />
          <Text style={[styles.name, titleFont, !fontsLoaded && styles.fontFallbackBold]}>{user.name}</Text>
          <Text style={[styles.email, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>{user.email}</Text>

          <View style={styles.pointsRow}>
            <Text style={[styles.pointsLabel, titleFont, !fontsLoaded && styles.fontFallbackBold]}>Points</Text>
            <Text style={[styles.pointsValue, titleFont, !fontsLoaded && styles.fontFallbackBold]}>{user.points.toLocaleString()}</Text>
          </View>
        </View>

        {hasPrivacyPolicyUrl() ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Privacy policy"
            onPress={handlePrivacyPress}
            style={({ pressed }) => [styles.privacyPress, pressed && styles.privacyPressed]}>
            <Text style={[styles.privacyText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
              Privacy Policy
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          accessibilityState={{ disabled: signingOut }}
          disabled={signingOut}
          onPress={handleSignOut}
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutPressed, signingOut && styles.signOutDisabled]}>
          {signingOut ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.signOutText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>SIGN OUT</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          accessibilityState={{ disabled: deleting }}
          disabled={deleting}
          onPress={handleDeleteAccount}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.deletePressed, deleting && styles.deleteDisabled]}>
          {deleting ? (
            <ActivityIndicator color="#E53935" />
          ) : (
            <Text style={[styles.deleteText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>DELETE ACCOUNT</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFF8EF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E8D9C8',
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#3D2914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#2A93F4',
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: '900',
    color: '#3E2723',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#5D4037',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D2C4',
  },
  metaLabel: {
    fontSize: 14,
    color: '#6D4C41',
  },
  metaValue: {
    fontSize: 15,
    color: '#3E2723',
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  pointsLabel: {
    fontSize: 16,
    color: '#1565C0',
  },
  pointsValue: {
    fontSize: 22,
    color: '#0D47A1',
  },
  privacyPress: {
    alignSelf: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  privacyPressed: {
    opacity: 0.85,
  },
  privacyText: {
    color: '#FFF59D',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  signOutBtn: {
    backgroundColor: '#E53935',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#C62828',
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutPressed: {
    opacity: 0.9,
  },
  signOutDisabled: {
    opacity: 0.7,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  deleteBtn: {
    marginTop: 14,
    backgroundColor: 'transparent',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E53935',
    paddingVertical: 14,
    alignItems: 'center',
  },
  deletePressed: {
    opacity: 0.85,
  },
  deleteDisabled: {
    opacity: 0.7,
  },
  deleteText: {
    color: '#FFCDD2',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  fontFallbackBold: {
    fontWeight: '900',
  },
  fontFallbackSemi: {
    fontWeight: '600',
  },
});
