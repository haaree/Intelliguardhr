import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Login from './Login';
import type { User } from '@supabase/supabase-js';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // FALLBACK: Check for local admin session first
    const checkAuth = async () => {
      try {
        const localSession = localStorage.getItem('local_admin_session');

        if (localSession) {
          console.log('🔐 Found local admin session');
          const session = JSON.parse(localSession);
          setUser(session.user as User);
          setLoading(false);
          return;
        }

        // Try Supabase authentication
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        setLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        // Check local session as fallback
        const localSession = localStorage.getItem('local_admin_session');
        if (localSession) {
          const session = JSON.parse(localSession);
          setUser(session.user as User);
        }
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only update if not using local admin
      if (!localStorage.getItem('local_admin_session')) {
        setUser(session?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <>{children}</>;
}
