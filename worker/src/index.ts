// Main Cloudflare Worker entry point
// MiniMax Auto Check-in System

import { Hono } from 'hono';
import { Env } from './types';
import { corsMiddleware, errorHandler, requestLogger, authMiddleware } from './utils/middleware';
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import adminRoutes from './routes/admin';
import { handleCron, handleCronRequest } from './routes/cron';

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Apply global middleware
app.use('*', requestLogger);
app.use('*', errorHandler);
app.use('*', corsMiddleware);

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'MiniMax Auto Check-in API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check for monitoring
app.get('/health', (c) => {
  return c.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Cron endpoint (for Cloudflare scheduled events or manual triggers)
app.all('/__cron', async (c) => {
  return handleCronRequest(c.req.raw, c.env);
});

// Scheduled event handler (Cloudflare Workers specific)
export const scheduled: ExportedHandler<Env>['scheduled'] = async (event, env, ctx) => {
  ctx.waitUntil(handleCron(env));
};

// Public routes (no authentication required)
app.route('/api/auth', authRoutes);

// Protected routes (authentication required)
const protectedApp = new Hono<{ Bindings: Env }>();
protectedApp.use('*', authMiddleware);

// Account routes
protectedApp.route('/accounts', accountRoutes);

// Admin routes
protectedApp.route('/admin', adminRoutes);

// Mount protected routes under /api
app.route('/api', protectedApp);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not found'
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Application error:', err);
  return c.json({
    success: false,
    error: err.message || 'Internal server error'
  }, 500);
});

// Export the worker
export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(handleCron(env));
  }
};

// Type declarations for Cloudflare Workers
interface ScheduledEvent {
  cron: string;
  scheduledTime: Date;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
