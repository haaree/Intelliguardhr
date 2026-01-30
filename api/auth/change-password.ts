
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

const CLOUD_RUN_DB_URL = 'postgresql://neondb_owner:npg_WVLem0FjB3UE@ep-withered-butterfly-ahyxi7yz-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { email, currentPassword, newPassword } = await req.json();
    
    if (!email || !currentPassword || !newPassword) {
      return new Response(JSON.stringify({ error: 'Missing required credentials.' }), { status: 400 });
    }

    const databaseUrl = process.env.DATABASE_URL || CLOUD_RUN_DB_URL;

    if (!databaseUrl) {
      return new Response(JSON.stringify({ error: 'Security Gateway Misconfiguration' }), { status: 500 });
    }

    const sql = neon(databaseUrl);
    
    // 1. Verify current password
    const user = await sql`
      SELECT id FROM authorized_emails 
      WHERE LOWER(email) = LOWER(${email}) 
      AND password = ${currentPassword}
      LIMIT 1
    `;

    if (user.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Current password verification failed.' 
      }), { status: 403 });
    }

    // 2. Update to new password
    await sql`
      UPDATE authorized_emails 
      SET password = ${newPassword} 
      WHERE LOWER(email) = LOWER(${email})
    `;

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Security Key updated successfully.' 
    }), { status: 200 });

  } catch (error) {
    console.error('Password Update Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Security Error' }), { status: 500 });
  }
}
