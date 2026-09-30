import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { generateUsername } from '../utils/usernameGenerator.js';
import { getJwtSecret } from '../config/jwt.js';

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const { fullName, email, password, phone, age, address, city, state, pincode } = req.body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ status: 'error', message: 'Full name is required.' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ status: 'error', message: 'A valid email address is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ status: 'error', message: 'Invalid email address format.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'Email is already registered.' });
    }

    // Automatically generate unique readable username from email
    const username = generateUsername(normalizedEmail, db);

    // Hash password with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const parsedAge = age !== undefined && age !== '' && !isNaN(Number(age)) ? Number(age) : null;

    const stmt = db.prepare(`
      INSERT INTO users (
        username, full_name, email, password_hash, phone, age, address, city, state, pincode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      username,
      fullName.trim(),
      normalizedEmail,
      passwordHash,
      phone ? String(phone).trim() : null,
      parsedAge,
      address ? String(address).trim() : null,
      city ? String(city).trim() : null,
      state ? String(state).trim() : null,
      pincode ? String(pincode).trim() : null
    );

    const newUserId = result.lastInsertRowid;

    // Sign JWT
    const token = jwt.sign({ userId: newUserId, role: 'USER' }, getJwtSecret(), { expiresIn: '7d' });

    return res.status(201).json({
      status: 'success',
      token,
      user: {
        id: newUserId,
        username,
        fullName: fullName.trim(),
        email: normalizedEmail,
        role: 'USER',
        phone: phone ? String(phone).trim() : null,
        age: parsedAge,
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : null,
        state: state ? String(state).trim() : null,
        pincode: pincode ? String(pincode).trim() : null
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ status: 'error', message: 'Registration failed due to a server error.' });
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const rawIdentifier = (req.body.email || req.body.username || req.body.identifier || '').trim();
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.status(400).json({ status: 'error', message: 'Email or username and password are required.' });
    }

    const normalizedIdentifier = rawIdentifier.toLowerCase();

    const user = db.prepare(`
      SELECT id, username, full_name AS fullName, email, password_hash, COALESCE(role, 'USER') AS role
      FROM users
      WHERE LOWER(email) = ? OR LOWER(username) = ?
    `).get(normalizedIdentifier, normalizedIdentifier);

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, getJwtSecret(), { expiresIn: '7d' });

    return res.status(200).json({
      status: 'success',
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ status: 'error', message: 'Login failed due to a server error.' });
  }
}

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 */
export function getMe(req, res) {
  // Attached securely by authMiddleware from token
  return res.status(200).json(req.user);
}

/**
 * Update authenticated user profile
 * PUT /api/auth/profile
 */
export function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { fullName, phone, age, address, city, state, pincode } = req.body;

    const newFullName = fullName !== undefined ? String(fullName).trim() : req.user.fullName;
    const newPhone = phone !== undefined ? String(phone).trim() : req.user.phone;
    const newAge = age !== undefined && age !== '' && !isNaN(Number(age)) ? Number(age) : req.user.age;
    const newAddress = address !== undefined ? String(address).trim() : req.user.address;
    const newCity = city !== undefined ? String(city).trim() : req.user.city;
    const newState = state !== undefined ? String(state).trim() : req.user.state;
    const newPincode = pincode !== undefined ? String(pincode).trim() : req.user.pincode;

    db.prepare(`
      UPDATE users
      SET full_name = ?, phone = ?, age = ?, address = ?, city = ?, state = ?, pincode = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newFullName, newPhone, newAge, newAddress, newCity, newState, newPincode, userId);

    const updated = db.prepare(`
      SELECT id, username, full_name AS fullName, email, phone, age, address, city, state, pincode, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(userId);

    return res.status(200).json(updated);
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to update profile.' });
  }
}
