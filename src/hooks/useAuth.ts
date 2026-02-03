// ============================================================================
// useAuth Hook - Centralized Authentication State Management
// ============================================================================
// Manages user authentication state, profile, and authorization
// ============================================================================

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getUserProfile } from '../lib/api';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../lib/types';

interface UseAuthReturn {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isApproved: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

/**
 * Centralized auth hook
 * Manages Supabase auth + Azure SQL user profile with role
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session check with timeout protection
    const initAuth = async () => {
      try {
        console.log('🔐 Initializing authentication...');
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        // Fetch user profile from Azure SQL to get role and approval status
        if (session?.user) {
          console.log('👤 Fetching user profile for:', session.user.email);

          // Add timeout protection - if profile fetch takes more than 10 seconds, continue anyway
          const profilePromise = getUserProfile(session.user.id);
          const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => {
              console.warn('⚠️ Profile fetch timeout - continuing without profile');
              resolve(null);
            }, 10000) // 10 second timeout
          );

          const userProfile = await Promise.race([profilePromise, timeoutPromise]);
          setProfile(userProfile);

          if (userProfile) {
            console.log('✅ Profile loaded:', userProfile.email, 'role:', userProfile.role);
          } else {
            console.warn('⚠️ Profile not loaded - user can still access auth page');
          }
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
      } finally {
        console.log('✅ Auth initialization complete');
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          console.log('🔄 Auth state changed:', _event);
          setUser(session?.user ?? null);

          if (session?.user) {
            // Fetch updated profile with timeout protection
            const profilePromise = getUserProfile(session.user.id);
            const timeoutPromise = new Promise<null>((resolve) =>
              setTimeout(() => {
                console.warn('⚠️ Profile fetch timeout on auth change - continuing');
                resolve(null);
              }, 10000) // 10 second timeout
            );

            const userProfile = await Promise.race([profilePromise, timeoutPromise]);
            setProfile(userProfile);

            if (userProfile) {
              console.log('✅ Profile updated:', userProfile.email);
            }
          } else {
            setProfile(null);
          }
        } catch (error) {
          console.error('❌ Error fetching profile during auth state change:', error);
          // If profile fetch fails, still set user but leave profile as null
          // This allows the user to at least see the auth page
        } finally {
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return {
    user,
    profile,
    isAdmin: profile?.role === 'admin',
    isApproved: profile?.is_approved ?? false,
    loading,
    signOut: handleSignOut,
  };
}
