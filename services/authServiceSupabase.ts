import { UserRole } from '../types.ts';
import { supabase } from '../src/lib/supabase.ts';

export interface AuthSession {
  user: {
    email: string;
    role: UserRole;
    name: string;
    id: string;
  };
  token: string;
}

/**
 * Supabase-based authentication service
 * Replaces the Neon database authentication
 */
export const authService = {
  /**
   * Verify user credentials using Supabase Auth
   */
  async verifyWhitelist(email: string, password?: string): Promise<{
    authorized: boolean;
    role: UserRole;
    error?: string;
    type?: string;
    bootstrap?: boolean;
    message?: string
  } | null> {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const normalizedPassword = (password || '').trim();

    if (!normalizedPassword) {
      return {
        authorized: false,
        role: 'Employee',
        error: 'Password is required'
      };
    }

    try {
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });

      if (error) {
        console.error('Supabase auth error:', error);
        return {
          authorized: false,
          role: 'Employee',
          error: error.message || 'Authentication failed',
          type: error.name
        };
      }

      if (!data.user) {
        return {
          authorized: false,
          role: 'Employee',
          error: 'Authentication failed'
        };
      }

      // Get user metadata for role (you can set this when creating users)
      const role = (data.user.user_metadata?.role as UserRole) || 'Employee';
      const name = data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User';

      return {
        authorized: true,
        role: role,
        message: 'Authentication successful'
      };
    } catch (err: any) {
      console.error('Authentication error:', err);
      return {
        authorized: false,
        role: 'Employee',
        error: err.message || 'Authentication service error'
      };
    }
  },

  /**
   * Change password using Supabase
   */
  async changePassword(email: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // First verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: currentPassword,
      });

      if (signInError) {
        return {
          success: false,
          message: 'Current password is incorrect'
        };
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        return {
          success: false,
          message: updateError.message || 'Failed to update password'
        };
      }

      return {
        success: true,
        message: 'Password updated successfully'
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Password change service unavailable'
      };
    }
  },

  /**
   * Logout and clear session
   */
  async logout() {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('intelliguard_session');
    } catch (err) {
      console.error('Logout error:', err);
      localStorage.removeItem('intelliguard_session');
    }
  }
};
