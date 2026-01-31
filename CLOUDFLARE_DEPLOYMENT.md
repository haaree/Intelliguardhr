# Cloudflare Pages Deployment Guide

## Quick Start

This Vite + React + TypeScript application is configured for Cloudflare Pages deployment.

### Prerequisites
- GitHub repository connected to Cloudflare Pages
- Cloudflare account with Pages enabled
- Supabase project created
- Environment variables ready (GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY)

## Deployment Method: GitHub Integration (Recommended)

### Step 1: Connect Repository to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → Click **"Create"** button
3. **IMPORTANT:** Select the **"Pages"** tab (NOT the "Workers" tab)
4. Click **"Connect to Git"**
5. Choose **GitHub** and authorize Cloudflare
6. Select repository: `Intelliguardhr`
7. Branch: `master`

**WARNING:** If you see fields like "Deploy command: npx wrangler deploy" or "Version command", you're in the wrong section (Workers instead of Pages). Make sure you're in the **Pages** tab.

### Step 2: Configure Build Settings

In the build configuration screen:

```
Framework preset: None (or VitePress if Vite is not available)
Build command: npm run build
Build output directory: dist
Root directory: (leave blank)
Node version: 22
```

**NOTE:** If "Vite" is not in the framework preset dropdown, select "None" or "VitePress". The important part is the build command (`npm run build`) which will use your project's Vite configuration.

**CRITICAL:** In the **Pages** setup, there are NO "Deploy command" or "Version command" fields. If you see these fields, you're configuring a **Worker** instead of **Pages**.

Cloudflare Pages automatically deploys the `dist` folder after the build completes - no additional commands needed.

### Step 3: Add Environment Variables

Click **"Add variable"** for each:

**Production Environment:**
- `NODE_ENV` = `production`
- `GEMINI_API_KEY` = `your_gemini_api_key_here`
- `VITE_SUPABASE_URL` = `your_supabase_project_url` (e.g., https://xxxxx.supabase.co)
- `VITE_SUPABASE_ANON_KEY` = `your_supabase_anon_public_key`

**Preview Environment:**
- Same variables with preview/test values

**Where to find Supabase credentials:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → Use as `VITE_SUPABASE_URL`
   - **anon public key** → Use as `VITE_SUPABASE_ANON_KEY`

### Step 4: Deploy

1. Click **"Save and Deploy"**
2. Cloudflare will:
   - Clone your repository
   - Run `npm ci`
   - Run `npm run build`
   - Deploy `dist` folder to global CDN
   - Provide URL: `https://intelliguard-hr.pages.dev`

## Custom Domain Setup

### Add Custom Domain: asp.intelliguard.in

1. In your Pages project, go to **Custom domains**
2. Click **"Set up a custom domain"**
3. Enter: `asp.intelliguard.in`
4. Cloudflare will provide DNS instructions

### DNS Configuration

**Option A: Using Cloudflare Nameservers (Recommended)**
1. Change your domain's nameservers to Cloudflare's
2. Cloudflare will automatically configure DNS
3. SSL certificate auto-generated

**Option B: CNAME Record**
1. Add CNAME record in your DNS provider:
   ```
   Type: CNAME
   Name: asp
   Value: intelliguard-hr.pages.dev
   TTL: Auto
   ```
2. Wait for DNS propagation (5-30 minutes)
3. Cloudflare will auto-generate SSL certificate

## Files Configuration

### ✅ Already Configured

1. **public/_redirects** - Client-side routing
   ```
   /* /index.html 200
   ```

2. **public/_headers** - Security headers
   - Cache control for assets
   - Security headers (CSP, XSS protection, etc.)

3. **vite.config.ts** - Build configuration
   - Allowed hosts include `.pages.dev`
   - Environment variable handling
   - Code splitting optimization

4. **package.json** - Build scripts
   - `npm run build` - Production build
   - `npm run preview` - Local preview

## Environment Variables Access in Code

Cloudflare Pages injects environment variables at build time:

```typescript
// In your React components or services
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

**Note:** Use the `VITE_` prefix for all environment variables that need to be accessible in your React code during build time.

## Local Testing

Test production build locally before deploying:

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Open http://localhost:3006
```

## Deployment Process

### Automatic Deployments

Every push to `master` branch triggers:
1. Build process on Cloudflare's servers
2. Automatic deployment to production
3. Previous version kept for instant rollback

### Manual Deployments

In Cloudflare Dashboard:
1. Go to **Deployments**
2. Click **"Retry deployment"** or **"Rollback"**

## Troubleshooting

### Build Fails

**Issue**: `npm run build` fails
**Solution**: Check build logs in Cloudflare Dashboard
- Verify Node version is 22
- Check environment variables are set
- Ensure all dependencies in package.json

### 404 on Routes

**Issue**: Direct navigation to routes returns 404
**Solution**: Ensure `public/_redirects` file exists with:
```
/* /index.html 200
```

### Environment Variables Not Working

**Issue**: API keys or Supabase credentials undefined
**Solution**:
- Check variables are set in Cloudflare Pages settings with `VITE_` prefix
- Rebuild/redeploy after adding variables
- Use `import.meta.env.VITE_VARIABLE_NAME` in your code
- Ensure variables are added to both Production and Preview environments

### Custom Domain Not Working

**Issue**: asp.intelliguard.in not loading
**Solution**:
- Verify DNS records are correct
- Wait for DNS propagation (up to 24 hours)
- Check SSL certificate status in Cloudflare

## Performance Optimizations

### Already Implemented

1. **Code Splitting**
   - React vendor bundle
   - Charts library separate
   - Utils separate
   - Reduces initial load time

2. **Asset Caching**
   - Static assets: 1 year cache
   - HTML: 1 hour cache with revalidation

3. **Global CDN**
   - Cloudflare's edge network
   - Assets served from nearest location
   - Automatic DDoS protection

### Additional Recommendations

1. Enable **Web Analytics** in Cloudflare Pages
2. Use **Cloudflare Images** for image optimization
3. Consider **Cloudflare Workers** for API endpoints (future)

## Security

### Headers Applied

- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-Frame-Options: SAMEORIGIN` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Privacy
- `Permissions-Policy` - Restricts device access

### SSL/TLS

- Automatic SSL certificate
- HTTPS enforced
- HTTP auto-redirects to HTTPS

## Monitoring

### Build Logs

View in Cloudflare Dashboard:
- Build time
- Deploy time
- Error messages
- Environment variables used

### Analytics

Enable in Pages settings:
- Page views
- Geographic distribution
- Performance metrics
- Error tracking

## Cost

**Cloudflare Pages Free Tier:**
- Unlimited requests
- Unlimited bandwidth
- 500 builds per month
- 1 build at a time
- 20,000 files per deployment

**Perfect for your application!**

## Support

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Troubleshooting](https://developers.cloudflare.com/pages/platform/known-issues/)

## Summary Checklist

- ✅ Repository connected to Cloudflare Pages
- ✅ Build settings configured (Vite, dist, npm run build)
- ✅ Environment variables added
- ✅ `_redirects` file for SPA routing
- ✅ `_headers` file for security
- ✅ Custom domain configured (asp.intelliguard.in)
- ✅ SSL certificate auto-generated
- ✅ Automatic deployments enabled

Your application is fully configured for Cloudflare Pages deployment!
