// Authentication middleware

import { Context, Next } from 'hono';
import { Env, JwtPayload } from '../types';
import { verifyJwt, extractToken } from './jwt';

// Extend Hono context with user info
declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

// Authentication middleware
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);
  
  if (!token) {
    return c.json({
      success: false,
      error: 'No authentication token provided'
    }, 401);
  }
  
  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    
    if (!payload) {
      return c.json({
        success: false,
        error: 'Invalid or expired token'
      }, 401);
    }
    
    // Store user info in context
    c.set('user', payload);
    
    await next();
  } catch (error) {
    return c.json({
      success: false,
      error: 'Authentication failed'
    }, 401);
  }
}

// Get current user from context
export function getCurrentUser(c: Context<{ Bindings: Env }>): JwtPayload {
  return c.get('user');
}

// CORS middleware
export async function corsMiddleware(c: Context, next: Next) {
  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      }
    });
  }
  
  await next();
  
  // Add CORS headers to response
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Error handling middleware
export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, 500);
  }
}

// Request logging middleware
export async function requestLogger(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  
  console.log(`[${new Date().toISOString()}] ${method} ${path} - Started`);
  
  await next();
  
  const duration = Date.now() - start;
  console.log(`[${new Date().toISOString()}] ${method} ${path} - ${c.res.status} (${duration}ms)`);
}
