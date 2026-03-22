// Admin and system routes

import { Hono } from 'hono';
import { Env, ApiResponse } from '../types';
import { getLogs, getAllActiveAccounts, getCronState, createOrUpdateCronState, updateCronState, createLog } from '../utils/db';
import { getCurrentUser } from '../utils/middleware';

const adminRoutes = new Hono<{ Bindings: Env }>();

// Get system logs
adminRoutes.get('/logs', async (c) => {
  const user = getCurrentUser(c);
  const limit = parseInt(c.req.query('limit') || '100');
  const accountId = c.req.query('accountId') ? parseInt(c.req.query('accountId')!) : undefined;
  
  const logs = await getLogs(c.env.DB, limit, accountId);
  
  return c.json<ApiResponse<{ logs: typeof logs; count: number }>>({
    success: true,
    data: {
      logs,
      count: logs.length
    }
  });
});

// Get system status
adminRoutes.get('/status', async (c) => {
  const user = getCurrentUser(c);
  
  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  
  // Get all accounts
  const accounts = await getAllActiveAccounts(c.env.DB);
  
  // Get cron state
  let cronState = await getCronState(c.env.DB, today);
  
  if (!cronState) {
    cronState = await createOrUpdateCronState(c.env.DB, today, accounts.length);
  }
  
  // Calculate stats
  const stats = {
    totalAccounts: accounts.length,
    activeToday: accounts.filter(a => a.checkin_status === 'success').length,
    pendingToday: accounts.filter(a => a.checkin_status === 'pending').length,
    failedToday: accounts.filter(a => a.checkin_status === 'failed').length,
    totalCredits: accounts.reduce((sum, a) => sum + a.current_credits, 0)
  };
  
  return c.json<ApiResponse<{
    stats: typeof stats;
    cronState: typeof cronState;
    currentTime: string;
    nextCheckIn: string | null;
  }>>({
    success: true,
    data: {
      stats,
      cronState,
      currentTime: new Date().toISOString(),
      nextCheckIn: cronState.next_run || null
    }
  });
});

// Get daily summary
adminRoutes.get('/summary/:date?', async (c) => {
  const user = getCurrentUser(c);
  const date = c.req.param('date') || new Date().toISOString().split('T')[0];
  
  // Get check-in stats for the date
  const stats = await c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total_accounts,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'already_checked_in' THEN 1 ELSE 0 END) as already_checked,
      SUM(credits_earned) as total_credits_earned
    FROM checkin_history
    WHERE date(checkin_time) = ?
  `).bind(date).first();
  
  // Get accounts that haven't been checked
  const pendingAccounts = await c.env.DB.prepare(`
    SELECT id, account_name, checkin_status
    FROM minimax_accounts
    WHERE is_active = 1
    AND id NOT IN (
      SELECT DISTINCT account_id 
      FROM checkin_history 
      WHERE date(checkin_time) = ?
    )
  `).bind(date).all();
  
  return c.json<ApiResponse<{
    date: string;
    stats: typeof stats;
    pendingAccounts: typeof pendingAccounts.results;
  }>>({
    success: true,
    data: {
      date,
      stats,
      pendingAccounts: pendingAccounts.results
    }
  });
});

// Manually trigger cron job (for testing)
adminRoutes.post('/trigger-cron', async (c) => {
  const user = getCurrentUser(c);
  
  await createLog(c.env.DB, 'info', 'Manual cron trigger requested by user');
  
  // Call the cron handler
  const response = await fetch(`${new URL(c.req.url).origin}/__cron`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ trigger: 'manual' })
  });
  
  return c.json<ApiResponse>({
    success: true,
    message: 'Cron job triggered'
  });
});

export default adminRoutes;
