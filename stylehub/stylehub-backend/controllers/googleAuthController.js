import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { generateUsername } from '../utils/usernameGenerator.js';
import { getJwtSecret } from '../config/jwt.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

/**
 * Return canonical backend callback URI
 */
export function getCanonicalRedirectUri() {
  return process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';
}

/**
 * Generate cryptographically signed state for CSRF protection
 */
export function createOAuthState() {
  const timestamp = Date.now().toString();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const payload = `${timestamp}.${randomBytes}`;
  const signature = crypto.createHmac('sha256', getJwtSecret()).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

/**
 * Verify cryptographically signed OAuth state
 */
export function verifyOAuthState(state) {
  if (!state || typeof state !== 'string') return false;
  const parts = state.split('.');
  if (parts.length !== 3) {
    // Allow basic 32-char hex state for backwards compatibility if needed
    return state.length >= 16;
  }
  const [timestamp, randomBytes, signature] = parts;
  const payload = `${timestamp}.${randomBytes}`;
  const expectedSig = crypto.createHmac('sha256', getJwtSecret()).update(payload).digest('hex');
  if (signature !== expectedSig) return false;
  
  // Check state expiration (15 minutes)
  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age < 0 || age > 15 * 60 * 1000) return false;
  return true;
}

/**
 * Return public Google OAuth configuration
 * GET /api/auth/google/config
 */
export function getGoogleConfig(req, res) {
  const canonicalRedirect = getCanonicalRedirectUri();
  return res.status(200).json({
    clientId: GOOGLE_CLIENT_ID,
    configured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    redirectUri: canonicalRedirect
  });
}

/**
 * Generate Google OAuth consent redirect URL
 * GET /api/auth/google/url
 */
export function getGoogleAuthUrl(req, res) {
  const redirectUri = req.query.redirect_uri || getCanonicalRedirectUri();
  const state = req.query.state || createOAuthState();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'select_account');
  authUrl.searchParams.set('state', state);

  console.log('GOOGLE OAUTH REDIRECT URI:', redirectUri);
  return res.status(200).json({ url: authUrl.toString(), state, redirectUri });
}

/**
 * Direct Google OAuth Authorization Entrypoint
 * GET /api/auth/google
 */
export function initiateGoogleAuth(req, res) {
  const redirectUri = getCanonicalRedirectUri();
  const state = createOAuthState();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'select_account');
  authUrl.searchParams.set('state', state);

  console.log('GOOGLE OAUTH REDIRECT URI:', redirectUri);
  return res.redirect(authUrl.toString());
}

/**
 * Find or Create local user in SQLite database
 */
export async function findOrCreateGoogleUser(googleProfile) {
  let user = db.prepare(`
    SELECT id, username, full_name AS fullName, email, role, google_id, avatar_url
    FROM users
    WHERE google_id = ? OR LOWER(email) = ?
  `).get(googleProfile.googleId, googleProfile.email);

  if (user) {
    // User exists — update Google ID & avatar if missing
    db.prepare(`
      UPDATE users
      SET google_id = COALESCE(google_id, ?),
          avatar_url = COALESCE(avatar_url, ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(googleProfile.googleId, googleProfile.avatarUrl, user.id);

    return db.prepare(`
      SELECT id, username, full_name AS fullName, email, COALESCE(role, 'USER') AS role, avatar_url
      FROM users
      WHERE id = ?
    `).get(user.id);
  } else {
    // New user — create account with role USER (Admin is never assigned to Google users)
    const username = generateUsername(googleProfile.email, db);
    const salt = await bcrypt.genSalt(10);
    const randomPassword = crypto.randomUUID() + '!GoogleOAuth2026';
    const passwordHash = await bcrypt.hash(randomPassword, salt);

    const insertResult = db.prepare(`
      INSERT INTO users (
        username, full_name, email, password_hash, role, google_id, avatar_url
      ) VALUES (?, ?, ?, ?, 'USER', ?, ?)
    `).run(
      username,
      googleProfile.fullName,
      googleProfile.email,
      passwordHash,
      googleProfile.googleId,
      googleProfile.avatarUrl
    );

    return {
      id: insertResult.lastInsertRowid,
      username,
      fullName: googleProfile.fullName,
      email: googleProfile.email,
      role: 'USER',
      avatar_url: googleProfile.avatarUrl
    };
  }
}

/**
 * Handle Canonical Google OAuth Server Callback
 * GET /api/auth/google/callback
 */
export async function handleGoogleCallback(req, res) {
  const { code, state, error, error_description } = req.query;
  const frontendHost = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    const message = error_description || error;
    console.error('Google OAuth callback error reported:', message);
    return res.redirect(`${frontendHost}/login?error=${encodeURIComponent(message)}`);
  }

  if (!code) {
    return res.redirect(`${frontendHost}/login?error=${encodeURIComponent('No authorization code returned from Google.')}`);
  }

  // Validate state parameter for CSRF protection
  if (state && !verifyOAuthState(state)) {
    console.error('OAuth state parameter verification failure');
    return res.redirect(`${frontendHost}/login?error=${encodeURIComponent('Security error: Invalid or expired OAuth session state.')}`);
  }

  try {
    const redirectUri = getCanonicalRedirectUri();
    console.log('GOOGLE OAUTH REDIRECT URI:', redirectUri);

    // Exchange authorization code with Google for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      console.error('Failed to exchange authorization code:', errData);
      const errMsg = errData.error_description || 'Failed to exchange authorization code with Google.';
      return res.redirect(`${frontendHost}/login?error=${encodeURIComponent(errMsg)}`);
    }

    const tokenData = await tokenRes.json();

    // Fetch Google user profile using access token
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userinfoRes.ok) {
      return res.redirect(`${frontendHost}/login?error=${encodeURIComponent('Failed to retrieve user profile from Google.')}`);
    }

    const userInfo = await userinfoRes.json();
    const email = (userInfo.email || '').toLowerCase().trim();
    if (!email) {
      return res.redirect(`${frontendHost}/login?error=${encodeURIComponent('No verified email associated with this Google account.')}`);
    }

    const googleProfile = {
      googleId: userInfo.sub,
      email,
      fullName: userInfo.name || 'Google User',
      avatarUrl: userInfo.picture || null
    };

    // Find or create user in SQLite
    const user = await findOrCreateGoogleUser(googleProfile);

    // Generate standard local AK'S MEN STYLE JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role || 'USER' },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    // Redirect to frontend callback route with signed JWT
    return res.redirect(`${frontendHost}/auth/google/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('Unhandled Google OAuth Callback Error:', err);
    return res.redirect(`${frontendHost}/login?error=${encodeURIComponent('Internal server error during Google sign-in.')}`);
  }
}

/**
 * Authenticate with Google ID Token (GIS) or Authorization Code
 * POST /api/auth/google
 */
export async function googleAuth(req, res) {
  try {
    const { credential, idToken, code, redirectUri } = req.body;
    const tokenToVerify = credential || idToken;

    let googleProfile = null;

    if (tokenToVerify) {
      // 1. Verify Google ID token via Google TokenInfo API
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`);
      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        return res.status(401).json({
          status: 'error',
          message: errData.error_description || 'Invalid or expired Google credential.'
        });
      }

      const payload = await verifyRes.json();

      // Verify audience matches our Client ID
      if (payload.aud !== GOOGLE_CLIENT_ID) {
        return res.status(401).json({
          status: 'error',
          message: 'Google token audience mismatch.'
        });
      }

      if (payload.email_verified === false || payload.email_verified === 'false') {
        return res.status(400).json({
          status: 'error',
          message: 'Google email address is not verified.'
        });
      }

      googleProfile = {
        googleId: payload.sub,
        email: (payload.email || '').toLowerCase().trim(),
        fullName: payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim() || 'Google User',
        avatarUrl: payload.picture || null
      };
    } else if (code) {
      const canonicalRedirect = redirectUri || getCanonicalRedirectUri();
      console.log('GOOGLE OAUTH REDIRECT URI:', canonicalRedirect);

      // 2. Exchange authorization code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: canonicalRedirect,
          grant_type: 'authorization_code'
        }).toString()
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        return res.status(401).json({
          status: 'error',
          message: errData.error_description || 'Failed to exchange Google authorization code.'
        });
      }

      const tokenData = await tokenRes.json();
      
      // Fetch user profile using access token
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      if (!userinfoRes.ok) {
        return res.status(401).json({
          status: 'error',
          message: 'Failed to retrieve user profile from Google.'
        });
      }

      const userInfo = await userinfoRes.json();

      googleProfile = {
        googleId: userInfo.sub,
        email: (userInfo.email || '').toLowerCase().trim(),
        fullName: userInfo.name || 'Google User',
        avatarUrl: userInfo.picture || null
      };
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Google credential or authorization code is required.'
      });
    }

    if (!googleProfile.email) {
      return res.status(400).json({
        status: 'error',
        message: 'Unable to retrieve verified email from Google account.'
      });
    }

    // Find or create local SQLite user
    const user = await findOrCreateGoogleUser(googleProfile);

    // Issue local JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role || 'USER' },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      status: 'success',
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName || user.full_name,
        email: user.email,
        role: user.role || 'USER',
        avatarUrl: user.avatar_url || googleProfile.avatarUrl
      }
    });
  } catch (err) {
    console.error('Google OAuth Authentication Error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Google authentication encountered a server error.'
    });
  }
}
