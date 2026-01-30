
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

// Primary Connection String from User
const CLOUD_RUN_DB_URL = 'postgresql://neondb_owner:npg_WVLem0FjB3UE@ep-withered-butterfly-ahyxi7yz-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { email, password } = await req.json();
    
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Identity and Security Key required.' }), { status: 400 });
    }

    // EMERGENCY BOOTSTRAP
    if (email.toLowerCase() === 'admin@intelliguard.com' && password === 'admin123') {
      return new Response(JSON.stringify({ 
        authorized: true, 
        role: 'SaaS_Admin',
        bootstrap: true,
        message: 'Bootstrap Emergency Access Granted.'
      }), { status: 200 });
    }

    const databaseUrl = process.env.DATABASE_URL || CLOUD_RUN_DB_URL;

    if (!databaseUrl) {
      return new Response(JSON.stringify({ 
        error: 'CRITICAL: Security Database not configured.',
        type: 'CONFIG_ERROR'
      }), { status: 500 });
    }

    const sql = neon(databaseUrl);
    
    // Standard verification against whitelisted email table
    const result = await sql`
      SELECT role FROM authorized_emails 
      WHERE LOWER(email) = LOWER(${email}) 
      AND password = ${password}
      LIMIT 1
    `;

    if (result.length > 0) {
      return new Response(JSON.stringify({ 
        authorized: true, 
        role: result[0].role 
      }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ 
        error: 'Identity not recognized in Neon registry.' 
      }), { status: 403 });
    }
  } catch (error: any) {
    console.error('Neon Gateway Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal Connection Failure: ' + (error.message || 'Unknown'),
      type: 'INTERNAL_ERROR'
    }), { status: 500 });
  }
}
