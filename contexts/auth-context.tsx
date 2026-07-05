import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { AppUserProfile } from '@/lib/firebase/user-profile';
import {
  createUserProfileDoc,
  deleteUserAccount,
  fetchUserProfile,
  fetchUserProfileWithRetry,
  rollbackNewAuthUser,
} from '@/lib/firebase/user-profile';
import { getFirebaseAuth, tryInitFirebase } from '@/lib/firebase/app';
import { loadGuestSession, saveGuestSession } from '@/lib/guest-session';
import type { ProfileAvatarId } from '@/lib/profile-avatars';

export type SignUpPayload = {
  email: string;
  password: string;
  name: string;
  avatarId: ProfileAvatarId;
};

type AuthResult = { ok: true } | { ok: false; message: string };

type AuthContextValue = {
  user: AppUserProfile | null;
  isLoggedIn: boolean;
  isGuest: boolean;
  /** Auth + guest preference have finished loading. */
  isSessionReady: boolean;
  isHydrated: boolean;
  isFirebaseReady: boolean;
  /** Signed in or chose to continue as guest. */
  hasAppAccess: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  signUp: (payload: SignUpPayload) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Permanently deletes the account (Firestore data + Firebase Auth user). */
  deleteAccount: () => Promise<AuthResult>;
  continueAsGuest: () => Promise<void>;
  /** Reload `user` from Firestore (e.g. after points change). Uses a server read; optional retry until points reach a minimum. */
  refreshProfile: (opts?: { untilPointsAtLeast?: number }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const mapAuthError = (err: unknown): string => {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    switch (code) {
      case 'auth/email-already-in-use':
        return 'That email is already registered. Try logging in.';
      case 'auth/invalid-email':
        return 'Please enter a valid email.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email or password is incorrect.';
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 6 characters.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again later.';
      default:
        return 'Something went wrong. Try again.';
    }
  }
  return 'Something went wrong. Try again.';
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUserProfile | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isGuestHydrated, setIsGuestHydrated] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  const clearGuestMode = useCallback(async () => {
    await saveGuestSession(false);
    setIsGuest(false);
  }, []);

  useEffect(() => {
    void loadGuestSession().then((active) => {
      setIsGuest(active);
      setIsGuestHydrated(true);
    });
  }, []);

  useEffect(() => {
    const ready = tryInitFirebase();
    setIsFirebaseReady(ready);
    if (!ready) {
      setUser(null);
      setIsHydrated(true);
      return;
    }

    let unsub: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const auth = getFirebaseAuth();
      try {
        await auth.authStateReady();
      } catch {
        // Continue — listener still restores session when persistence is available.
      }
      if (cancelled) {
        return;
      }

      unsub = onAuthStateChanged(auth, async (next) => {
        if (!next) {
          setUser(null);
          setIsHydrated(true);
          return;
        }

        setUser(null);
        try {
          const profile = await fetchUserProfileWithRetry(next);
          if (!profile) {
            await firebaseSignOut(auth);
            setUser(null);
          } else {
            void saveGuestSession(false);
            setIsGuest(false);
            setUser(profile);
          }
        } catch {
          setUser(null);
        } finally {
          setIsHydrated(true);
        }
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const signUp = useCallback(async (payload: SignUpPayload): Promise<AuthResult> => {
    if (!tryInitFirebase()) {
      return { ok: false, message: 'Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* to .env and restart.' };
    }
    const email = payload.email.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return { ok: false, message: 'Please enter a valid email.' };
    }
    if (!payload.name.trim()) {
      return { ok: false, message: 'Please enter your name.' };
    }
    if (payload.password.length < 6) {
      return { ok: false, message: 'Password must be at least 6 characters.' };
    }

    const auth = getFirebaseAuth();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, payload.password);
      try {
        await createUserProfileDoc(cred.user, {
          email,
          name: payload.name.trim(),
          avatarId: payload.avatarId,
        });
        const profile = await fetchUserProfile(cred.user);
        if (profile) {
          await saveGuestSession(false);
          setIsGuest(false);
          setUser(profile);
        }
        return { ok: true };
      } catch (inner) {
        await rollbackNewAuthUser(cred.user);
        return { ok: false, message: mapAuthError(inner) };
      }
    } catch (err) {
      return { ok: false, message: mapAuthError(err) };
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    if (!tryInitFirebase()) {
      return { ok: false, message: 'Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* to .env and restart.' };
    }
    const e = email.trim().toLowerCase();
    if (!e || !isValidEmail(e)) {
      return { ok: false, message: 'Please enter a valid email.' };
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), e);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: mapAuthError(err) };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!tryInitFirebase()) {
      return { ok: false, message: 'Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* to .env and restart.' };
    }
    const e = email.trim().toLowerCase();
    if (!e || !password) {
      return { ok: false, message: 'Enter your email and password.' };
    }
    const auth = getFirebaseAuth();
    try {
      const cred = await signInWithEmailAndPassword(auth, e, password);
      const profile = await fetchUserProfileWithRetry(cred.user, { attempts: 5, delayMs: 100 });
      if (!profile) {
        await firebaseSignOut(auth);
        return {
          ok: false,
          message: 'Your account has no profile data. Contact support or sign up again.',
        };
      }
      await saveGuestSession(false);
      setIsGuest(false);
      setUser(profile);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: mapAuthError(err) };
    }
  }, []);

  const continueAsGuest = useCallback(async () => {
    await saveGuestSession(true);
    setIsGuest(true);
  }, []);

  const signOut = useCallback(async () => {
    await clearGuestMode();
    if (!tryInitFirebase()) {
      setUser(null);
      return;
    }
    try {
      await firebaseSignOut(getFirebaseAuth());
    } catch {
      // ignore
    }
    setUser(null);
  }, [clearGuestMode]);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (!tryInitFirebase()) {
      return { ok: false, message: 'Firebase is not configured.' };
    }
    const current = getFirebaseAuth().currentUser;
    if (!current) {
      return { ok: false, message: 'You are not logged in.' };
    }
    try {
      await deleteUserAccount(current);
      await clearGuestMode();
      setUser(null);
      return { ok: true };
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err) {
        const code = String((err as { code: string }).code);
        if (code === 'auth/requires-recent-login') {
          return {
            ok: false,
            message: 'For security, please log out, log back in, and try deleting again.',
          };
        }
      }
      return { ok: false, message: mapAuthError(err) };
    }
  }, [clearGuestMode]);

  const refreshProfile = useCallback(async (opts?: { untilPointsAtLeast?: number }) => {
    if (!tryInitFirebase()) {
      return;
    }
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (!u) {
      return;
    }
    const target = opts?.untilPointsAtLeast;
    const maxAttempts = target !== undefined ? 6 : 1;
    for (let i = 0; i < maxAttempts; i++) {
      const profile = await fetchUserProfile(u, { preferServer: true });
      if (!profile) {
        return;
      }
      setUser(profile);
      if (target === undefined || profile.points >= target) {
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }, []);

  const isLoggedIn = Boolean(user);
  const isSessionReady = isHydrated && isGuestHydrated;
  const hasAppAccess = isLoggedIn || isGuest;

  const value = useMemo(
    () => ({
      user,
      isLoggedIn,
      isGuest,
      isSessionReady,
      isHydrated,
      isFirebaseReady,
      hasAppAccess,
      signIn,
      resetPassword,
      signUp,
      signOut,
      deleteAccount,
      continueAsGuest,
      refreshProfile,
    }),
    [
      user,
      isLoggedIn,
      isGuest,
      isSessionReady,
      isHydrated,
      isFirebaseReady,
      hasAppAccess,
      signIn,
      resetPassword,
      signUp,
      signOut,
      deleteAccount,
      continueAsGuest,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
