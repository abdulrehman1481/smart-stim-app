import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { ensureUserDocument, getUserProfile, UserProfile } from "../firebase/dataLogger";
import { bleService } from "../functionality/BLEService";

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) return;
    const p = await getUserProfile(user.uid);
    setProfile(p);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Ensure top-level user doc exists (needed for Firestore security rules)
        await ensureUserDocument(firebaseUser.uid, firebaseUser.email);
        // Load cached profile
        const p = await getUserProfile(firebaseUser.uid);
        setProfile(p);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    // Disconnect BLE before signing out so we don't leave the device paired
    // with a now-unauthenticated app instance, and so the sensor pipeline
    // stops writing to Firestore before the auth token is revoked.
    try {
      await bleService.disconnect();
    } catch (e) {
      // Not fatal - proceed with logout even if disconnect fails
    }
    await signOut(auth);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
};
