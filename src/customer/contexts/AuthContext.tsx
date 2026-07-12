// Authentication context for managing user state across the application
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';

// Types for our authentication context - using existing app_users table structure
interface AppUser {
  id: string;
  user_id: string;
  firebase_uid: string | null;
  email: string;
  full_name: string;
  role_id: string;
  is_active: boolean | null;
  last_login: string | null;
  invitation_accepted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface AuthContextType {
  currentUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAppUser: () => Promise<void>;
}

// Create the authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Authentication provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch user data from Supabase
  const fetchAppUser = async (firebaseUser: User) => {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('firebase_uid', firebaseUser.uid)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error fetching app user:', error);
        return null;
      }

      // Update last login
      if (data) {
        await supabase
          .from('app_users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.id);
      }

      return data;
    } catch (error) {
      console.error('Error in fetchAppUser:', error);
      return null;
    }
  };

  // Function to create or sync user in Supabase
  const syncUserWithSupabase = async (firebaseUser: User) => {
    try {
      // First, try to find existing user
      let appUserData = await fetchAppUser(firebaseUser);

      // If user doesn't exist, create them (this would typically be done by an admin)
      if (!appUserData) {
        console.log('User not found in app_users table. Contact admin to add user.');
        return null;
      }

      return appUserData;
    } catch (error) {
      console.error('Error syncing user with Supabase:', error);
      return null;
    }
  };

  // Function to refresh app user data
  const refreshAppUser = async () => {
    if (currentUser) {
      const userData = await fetchAppUser(currentUser);
      setAppUser(userData);
    }
  };

  // Function to sign out
  const signOut = async () => {
    try {
      const { signOutUser } = await import('../lib/firebase');
      await signOutUser();
      setCurrentUser(null);
      setAppUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Set up authentication state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // User is signed in, sync with Supabase
        const userData = await syncUserWithSupabase(user);
        setAppUser(userData);
      } else {
        // User is signed out
        setAppUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    appUser,
    loading,
    signOut,
    refreshAppUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};