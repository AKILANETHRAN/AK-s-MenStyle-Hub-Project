# Google login: Vercel frontend and Render backend

The backend exchanges Google's authorization code, then redirects to the frontend
at `/auth/google/callback?token=...`. A FRONTEND_URL without `https://` is treated
as a relative path and sends the browser back to a nonexistent backend route.

## Render environment

```dotenv
FRONTEND_URL=https://ak-s-men-style-hub-project.vercel.app
GOOGLE_CALLBACK_URL=https://YOUR-RENDER-SERVICE.onrender.com/api/auth/google/callback
```

Replace YOUR-RENDER-SERVICE with the actual Render backend hostname. Keep the
existing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and JWT_SECRET. Save the settings
and redeploy the backend. FRONTEND_URL is the frontend origin, without any path.

## Vercel environment

```dotenv
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

Do not append `/api`: the frontend already adds it. Redeploy the frontend after
changing this build-time value. Use the `vercel.json` in the selected frontend
root so direct visits to `/auth/google/callback` load the React application.
The merged frontend build delegates to `stylehub/stylehub-frontend`.

## Google OAuth client

In the client matching Render's GOOGLE_CLIENT_ID, set the authorized redirect URI
to exactly GOOGLE_CALLBACK_URL above. Set the authorized JavaScript origin to
`https://ak-s-men-style-hub-project.vercel.app`.

## Verify after deployment

1. Open the backend `/api/auth/google/config` endpoint and confirm redirectUri
   equals the Render callback URL.
2. Open the frontend `/auth/google/callback` without a token. The application's
   authentication failure page should load, rather than a hosting 404.
3. Start a fresh Google login. After Google's backend callback, the browser should
   visit the Vercel callback and then the home or profile page.

Local regression check: `node --test test/frontend-url-test.js` from the backend.
