
import { UserRole } from '../types.ts';
import { neon } from '@neondatabase/serverless';

export interface AuthSession {
  user: {
    email: string;
    role: UserRole;
    name: string;
    id: string;
  };
  token: string;
}

const DIRECT_NEON_URI = 'postgresql://neondb_owner:npg_WVLem0FjB3UE@ep-withered-butterfly-ahyxi7yz-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

/**
 * Direct Browser-to-Neon Verification. 
 * Essential for Cloud Run where /api routes might return 404.
 */
async function performDirectNeonVerify(email: string, password?: string): Promise<{ authorized: boolean; role: UserRole; error?: string } | null> {
  try {
    console.log("Cloud Run Environment: Attempting direct Neon authentication...");
    const sql = neon(DIRECT_NEON_URI);
    const result = await sql`
      SELECT role FROM authorized_emails 
      WHERE LOWER(email) = LOWER(${email.trim()}) 
      AND password = ${password?.trim() || ''}
      LIMIT 1
    `;
    
    if (result.length > 0) {
      return { authorized: true, role: result[0].role as UserRole };
    }
    return { authorized: false, role: 'Employee', error: 'Authentication Failed: User not in registry.' };
  } catch (err: any) {
    console.error("Critical Auth Error:", err);
    return { authorized: false, role: 'Employee', error: `Identity Gateway Error: ${err.message}` };
  }
}

export const authService = {
  /**
   * Primary verify function with local bootstrap and Cloud Run failover support.
   */
  async verifyWhitelist(email: string, password?: string): Promise<{ authorized: boolean; role: UserRole; error?: string; type?: string; bootstrap?: boolean; message?: string } | null> {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const normalizedPassword = (password || '').trim();

    // 1. HARDCODED BOOTSTRAP OVERRIDE (Immediate Return)
    if (normalizedEmail === 'admin@intelliguard.com' && normalizedPassword === 'admin123') {
      console.log("Bootstrap Admin authenticated via local override.");
      return { 
        authorized: true, 
        role: 'SaaS_Admin', 
        bootstrap: true, 
        message: 'Local Bootstrap Successful.' 
      };
    }

    try {
      // 2. Try hitting the API endpoint
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword })
      });

      // 3. FAILOVER: If 404 (Cloud Run routing), use direct DB
      if (response.status === 404) {
        return await performDirectNeonVerify(normalizedEmail, normalizedPassword);
      }
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { 
          authorized: false, 
          role: 'Employee', 
          error: data.error || `Server Error: ${response.status}`,
          type: data.type
        };
      }
      
      return await response.json();
    } catch (err: any) {
      // 4. FAILOVER: On network failure, use direct DB
      console.warn('API Gateway Unreachable, attempting direct Neon connect...');
      return await performDirectNeonVerify(normalizedEmail, normalizedPassword);
    }
  },

  async changePassword(email: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, currentPassword, newPassword })
      });

      if (response.status === 404) {
        const sql = neon(DIRECT_NEON_URI);
        await sql`UPDATE authorized_emails SET password = ${newPassword} WHERE LOWER(email) = LOWER(${normalizedEmail}) AND password = ${currentPassword}`;
        return { success: true, message: 'Security Key updated via direct access.' };
      }

      return await response.json();
    } catch (err) {
      return { success: false, message: 'Security service unavailable.' };
    }
  },

  logout() {
    localStorage.removeItem('intelliguard_session');
  }
};
