// Authentication routes

import { Hono } from 'hono';
import { Env, User, UserCreate, UserLogin, ApiResponse } from '../types';
import { createUser, getUserByEmail, updateUserLastLogin } from '../utils/db';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { generateJwt } from '../utils/jwt';

const authRoutes = new Hono<{ Bindings: Env }>();

// Register new user
authRoutes.post('/register', async (c) => {
  const body = await c.req.json<UserCreate>();
  const { email, password, name } = body;
  
  // Validate input
  if (!email || !password) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Email and password are required'
    }, 400);
  }
  
  if (password.length < 6) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Password must be at least 6 characters'
    }, 400);
  }
  
  // Check if user already exists
  const existingUser = await getUserByEmail(c.env.DB, email);
  if (existingUser) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Email already registered'
    }, 400);
  }
  
  // Hash password
  const passwordHash = await hashPassword(password);
  
  // Create user
  try {
    const user = await createUser(c.env.DB, email, passwordHash, name);
    
    // Generate JWT token
    const token = await generateJwt({ userId: user.id, email: user.email }, c.env.JWT_SECRET);
    
    return c.json<ApiResponse<{ user: User; token: string }>>({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
          last_login: user.last_login
        },
        token
      },
      message: 'Registration successful'
    }, 201);
  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to create user'
    }, 500);
  }
});

// Login
authRoutes.post('/login', async (c) => {
  const body = await c.req.json<UserLogin>();
  const { email, password } = body;
  
  // Validate input
  if (!email || !password) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Email and password are required'
    }, 400);
  }
  
  // Get user
  const user = await getUserByEmail(c.env.DB, email);
  if (!user) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Invalid email or password'
    }, 401);
  }
  
  // Verify password (need to get password_hash)
  const userWithHash = await c.env.DB.prepare(
    'SELECT password_hash FROM users WHERE id = ?'
  ).bind(user.id).first<{ password_hash: string }>();
  
  if (!userWithHash || !(await verifyPassword(password, userWithHash.password_hash))) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Invalid email or password'
    }, 401);
  }
  
  // Update last login
  await updateUserLastLogin(c.env.DB, user.id);
  
  // Generate JWT token
  const token = await generateJwt({ userId: user.id, email: user.email }, c.env.JWT_SECRET);
  
  return c.json<ApiResponse<{ user: User; token: string }>>({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        last_login: user.last_login
      },
      token
    },
    message: 'Login successful'
  });
});

// Get current user
authRoutes.get('/me', async (c) => {
  const user = c.get('user');
  
  const userData = await c.env.DB.prepare(
    'SELECT id, email, name, created_at, last_login FROM users WHERE id = ?'
  ).bind(user.userId).first<User>();
  
  if (!userData) {
    return c.json<ApiResponse>({
      success: false,
      error: 'User not found'
    }, 404);
  }
  
  return c.json<ApiResponse<{ user: User }>>({
    success: true,
    data: { user: userData }
  });
});

export default authRoutes;
