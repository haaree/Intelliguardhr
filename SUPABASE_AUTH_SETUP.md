# Supabase Authentication Setup - Restricted Access

This guide explains how to set up authentication for a limited set of pre-approved users without allowing public signup.

## Configuration Steps

### Step 1: Disable Public Signup in Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Under **Email** provider:
   - **Disable** "Enable email signup"
   - This prevents users from self-registering
5. Click **Save**

### Step 2: Manually Create Authorized Users

Since public signup is disabled, you'll manually add users via the Supabase dashboard:

1. Go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter:
   - **Email**: user's email address
   - **Password**: temporary password (user should change it)
   - **Auto Confirm User**: Check this box (required)
4. Click **Create user**
5. Repeat for each authorized user

### Step 3: Configure Row Level Security (RLS)

Protect your database tables so only authenticated users can access data:

1. Go to **Database** → **Tables**
2. For each table, click the **...** menu → **Edit Table**
3. Enable **Row Level Security (RLS)**
4. Add policies:

```sql
-- Allow authenticated users to read data
CREATE POLICY "Allow authenticated users to read"
ON your_table_name
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert data
CREATE POLICY "Allow authenticated users to insert"
ON your_table_name
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update data
CREATE POLICY "Allow authenticated users to update"
ON your_table_name
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete data
CREATE POLICY "Allow authenticated users to delete"
ON your_table_name
FOR DELETE
TO authenticated
USING (true);
```

### Step 4: Install Supabase Client in Your App

```bash
npm install @supabase/supabase-js
```

### Step 5: Initialize Supabase Client

Create a file `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Step 6: Create Login Component

Create a file `src/components/Login.tsx`:

```typescript
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      console.log('Logged in:', data);
      // Redirect to dashboard or main app
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6">Login</h2>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### Step 7: Protect Routes with Authentication

Create a protected route wrapper `src/components/ProtectedRoute.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Login from './Login';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Login />;
  }

  return <>{children}</>;
}
```

### Step 8: Update Your App.tsx

Wrap your app with the ProtectedRoute:

```typescript
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

export default App;
```

### Step 9: Add Logout Functionality

```typescript
import { supabase } from '../lib/supabase';

const handleLogout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error logging out:', error);
  }
};

// In your component
<button onClick={handleLogout}>Logout</button>
```

## Environment Variables

Add to Cloudflare Pages and your `.env` file:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Security Best Practices

1. **Email Confirmation**: Keep "Auto Confirm User" enabled for manually created users
2. **Password Policy**: Set strong password requirements in Authentication → Policies
3. **RLS Policies**: Always enable Row Level Security on all tables
4. **Session Management**: Configure session timeout in Authentication → Settings
5. **MFA (Optional)**: Enable Multi-Factor Authentication for additional security

## User Management

### Add New User
1. Go to Authentication → Users
2. Click "Add user"
3. Fill in email and temporary password
4. Check "Auto Confirm User"
5. Share credentials securely with the user

### Remove User Access
1. Go to Authentication → Users
2. Find the user
3. Click "..." → Delete user

### Reset User Password
1. Go to Authentication → Users
2. Click "..." → Send password reset email
3. Or manually update the password

## Testing Locally

1. Create a `.env` file with your Supabase credentials
2. Run `npm install @supabase/supabase-js`
3. Run `npm run dev`
4. Try logging in with a manually created user

## Common Issues

### "Email logins are disabled" or "Server Error: 405"
**Issue**: Email authentication is not enabled in Supabase
**Solution**:
1. Go to Supabase Dashboard → Authentication → Providers
2. Find **Email** provider
3. Click to expand settings
4. **Enable** the toggle for "Enable email provider"
5. **Disable** "Enable email signup" (to prevent public registration)
6. **Enable** "Confirm email"
7. Click **Save**

**Additional checks**:
- Verify your Supabase project URL is correct (should end with `.supabase.co`)
- Check that the anon key is copied correctly (it's a long JWT token)
- Make sure environment variables are set in Cloudflare Pages settings

### "Email not confirmed"
- Ensure "Auto Confirm User" is checked when creating users manually

### "Invalid login credentials"
- Verify the user exists in Authentication → Users
- Check password is correct

### "User not authorized"
- Check RLS policies are correctly configured
- Verify user is authenticated (check browser console)

## Next Steps

Once authentication is working:
1. Add user roles (admin, viewer, editor) using custom claims
2. Implement role-based access control in RLS policies
3. Add profile management for users to update their information
4. Consider implementing password change functionality
