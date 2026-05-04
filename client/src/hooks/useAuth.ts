import { useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const { user, company, isLoading, setUser, setLoading } = useAuthStore();

  const login = useCallback(async (email: string, password: string) => {
    const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
    return firebaseUser;
  }, []);

  const register = useCallback(async (
    email: string,
    password: string,
    displayName: string,
    companyName: string
  ) => {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(newUser, { displayName });

    // Create company document
    await setDoc(doc(db, 'companies', newUser.uid), {
      name: companyName || `${displayName}'s Company`,
      ownerId: newUser.uid,
      plan: 'trial',
      onboardingCompleted: false,
      onboardingStep: 0,
      createdAt: serverTimestamp(),
      settings: { language: 'fr', aiPersonality: 'professional' },
    });

    // Create user document
    await setDoc(doc(db, 'users', newUser.uid), {
      uid: newUser.uid,
      email: newUser.email,
      displayName,
      companyId: newUser.uid,
      role: 'admin',
      createdAt: serverTimestamp(),
    });

    return newUser;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    const { user: googleUser } = await signInWithPopup(auth, provider);

    // Ensure Firestore documents exist for Google users
    const userRef = doc(db, 'users', googleUser.uid);
    const { getDoc } = await import('firebase/firestore');
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // First time Google login — create company + user docs
      await setDoc(doc(db, 'companies', googleUser.uid), {
        name: `${googleUser.displayName ?? 'My'}'s Company`,
        ownerId: googleUser.uid,
        plan: 'trial',
        onboardingCompleted: false,
        onboardingStep: 0,
        createdAt: serverTimestamp(),
        settings: { language: 'fr', aiPersonality: 'professional' },
      });
      await setDoc(userRef, {
        uid:         googleUser.uid,
        email:       googleUser.email,
        displayName: googleUser.displayName ?? '',
        photoURL:    googleUser.photoURL ?? null,
        companyId:   googleUser.uid,
        role:        'admin',
        createdAt:   serverTimestamp(),
      });
    }

    return googleUser;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, [setUser]);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  return {
    user,
    company,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    loginWithGoogle,
    logout,
    resetPassword,
  };
}
