// Database utility functions

import { Env, User, MiniMaxAccount, CheckinHistory, CreditHistory, SystemLog, CronState } from '../types';

// User operations
export async function createUser(db: D1Database, email: string, passwordHash: string, name?: string): Promise<User> {
  const result = await db.prepare(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING id, email, name, created_at, last_login'
  ).bind(email, passwordHash, name || null).first<User>();
  
  if (!result) {
    throw new Error('Failed to create user');
  }
  
  return result;
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  return await db.prepare(
    'SELECT id, email, password_hash, name, created_at, last_login FROM users WHERE email = ?'
  ).bind(email).first<User>();
}

export async function getUserById(db: D1Database, id: number): Promise<User | null> {
  return await db.prepare(
    'SELECT id, email, name, created_at, last_login FROM users WHERE id = ?'
  ).bind(id).first<User>();
}

export async function updateUserLastLogin(db: D1Database, id: number): Promise<void> {
  await db.prepare(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(id).run();
}

// MiniMax Account operations
export async function createAccount(
  db: D1Database, 
  userId: number, 
  accountName: string, 
  encryptedCookies: string
): Promise<MiniMaxAccount> {
  const result = await db.prepare(
    `INSERT INTO minimax_accounts (user_id, account_name, cookies) 
     VALUES (?, ?, ?) 
     RETURNING id, user_id, account_name, cookies, current_credits, last_checkin, checkin_status, is_active, created_at, updated_at`
  ).bind(userId, accountName, encryptedCookies).first<MiniMaxAccount>();
  
  if (!result) {
    throw new Error('Failed to create account');
  }
  
  return result;
}

export async function getAccountsByUserId(db: D1Database, userId: number): Promise<MiniMaxAccount[]> {
  const result = await db.prepare(
    'SELECT * FROM minimax_accounts WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(userId).all<MiniMaxAccount>();
  
  return result.results;
}

export async function getAccountById(db: D1Database, accountId: number, userId: number): Promise<MiniMaxAccount | null> {
  return await db.prepare(
    'SELECT * FROM minimax_accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, userId).first<MiniMaxAccount>();
}

export async function updateAccount(
  db: D1Database, 
  accountId: number, 
  userId: number,
  updates: { account_name?: string; cookies?: string; is_active?: number }
): Promise<MiniMaxAccount | null> {
  const setClause: string[] = [];
  const values: (string | number)[] = [];
  
  if (updates.account_name !== undefined) {
    setClause.push('account_name = ?');
    values.push(updates.account_name);
  }
  if (updates.cookies !== undefined) {
    setClause.push('cookies = ?');
    values.push(updates.cookies);
  }
  if (updates.is_active !== undefined) {
    setClause.push('is_active = ?');
    values.push(updates.is_active);
  }
  
  if (setClause.length === 0) return null;
  
  setClause.push('updated_at = CURRENT_TIMESTAMP');
  values.push(accountId, userId);
  
  const query = `UPDATE minimax_accounts SET ${setClause.join(', ')} WHERE id = ? AND user_id = ? RETURNING *`;
  
  return await db.prepare(query).bind(...values).first<MiniMaxAccount>();
}

export async function updateAccountCredits(
  db: D1Database, 
  accountId: number, 
  credits: number,
  checkinStatus: string
): Promise<void> {
  await db.prepare(
    'UPDATE minimax_accounts SET current_credits = ?, last_checkin = CURRENT_TIMESTAMP, checkin_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(credits, checkinStatus, accountId).run();
}

export async function deleteAccount(db: D1Database, accountId: number, userId: number): Promise<boolean> {
  const result = await db.prepare(
    'DELETE FROM minimax_accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, userId).run();
  
  return result.success && (result.meta.changes || 0) > 0;
}

// Get all active accounts for cron job (across all users)
export async function getAllActiveAccounts(db: D1Database): Promise<MiniMaxAccount[]> {
  const result = await db.prepare(
    'SELECT * FROM minimax_accounts WHERE is_active = 1 ORDER BY id ASC'
  ).all<MiniMaxAccount>();
  
  return result.results;
}

// Check-in History operations
export async function createCheckinHistory(
  db: D1Database,
  accountId: number,
  status: string,
  creditsBefore: number | null,
  creditsAfter: number | null,
  creditsEarned: number | null,
  errorMessage: string | null
): Promise<CheckinHistory> {
  const result = await db.prepare(
    `INSERT INTO checkin_history (account_id, status, credits_before, credits_after, credits_earned, error_message) 
     VALUES (?, ?, ?, ?, ?, ?) 
     RETURNING *`
  ).bind(accountId, status, creditsBefore, creditsAfter, creditsEarned, errorMessage).first<CheckinHistory>();
  
  if (!result) {
    throw new Error('Failed to create check-in history');
  }
  
  return result;
}

export async function getCheckinHistory(
  db: D1Database, 
  accountId: number, 
  limit: number = 30
): Promise<CheckinHistory[]> {
  const result = await db.prepare(
    'SELECT * FROM checkin_history WHERE account_id = ? ORDER BY checkin_time DESC LIMIT ?'
  ).bind(accountId, limit).all<CheckinHistory>();
  
  return result.results;
}

export async function getTodayCheckinCount(db: D1Database, accountId: number): Promise<number> {
  const result = await db.prepare(
    "SELECT COUNT(*) as count FROM checkin_history WHERE account_id = ? AND date(checkin_time) = date('now')"
  ).bind(accountId).first<{ count: number }>();
  
  return result?.count || 0;
}

// Credit History operations
export async function createCreditHistory(
  db: D1Database,
  accountId: number,
  credits: number
): Promise<void> {
  await db.prepare(
    'INSERT INTO credit_history (account_id, credits) VALUES (?, ?)'
  ).bind(accountId, credits).run();
}

export async function getCreditHistory(
  db: D1Database,
  accountId: number,
  limit: number = 30
): Promise<CreditHistory[]> {
  const result = await db.prepare(
    'SELECT * FROM credit_history WHERE account_id = ? ORDER BY recorded_at DESC LIMIT ?'
  ).bind(accountId, limit).all<CreditHistory>();
  
  return result.results;
}

// System Log operations
export async function createLog(
  db: D1Database,
  logType: 'info' | 'warning' | 'error',
  message: string,
  accountId?: number,
  details?: string
): Promise<SystemLog> {
  const result = await db.prepare(
    'INSERT INTO system_logs (log_type, account_id, message, details) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(logType, accountId || null, message, details || null).first<SystemLog>();
  
  if (!result) {
    throw new Error('Failed to create log');
  }
  
  return result;
}

export async function getLogs(
  db: D1Database,
  limit: number = 100,
  accountId?: number
): Promise<SystemLog[]> {
  let query = 'SELECT * FROM system_logs';
  const params: (number | string)[] = [];
  
  if (accountId) {
    query += ' WHERE account_id = ?';
    params.push(accountId);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  const result = await db.prepare(query).bind(...params).all<SystemLog>();
  return result.results;
}

// Cron State operations
export async function getCronState(db: D1Database, date: string): Promise<CronState | null> {
  return await db.prepare(
    'SELECT * FROM cron_state WHERE date = ?'
  ).bind(date).first<CronState>();
}

export async function createOrUpdateCronState(
  db: D1Database,
  date: string,
  totalAccounts: number
): Promise<CronState> {
  const existing = await getCronState(db, date);
  
  if (existing) {
    return existing;
  }
  
  const result = await db.prepare(
    `INSERT INTO cron_state (date, current_account_index, total_accounts, status) 
     VALUES (?, 0, ?, 'idle') 
     RETURNING *`
  ).bind(date, totalAccounts).first<CronState>();
  
  if (!result) {
    throw new Error('Failed to create cron state');
  }
  
  return result;
}

export async function updateCronState(
  db: D1Database,
  date: string,
  updates: {
    current_account_index?: number;
    total_accounts?: number;
    last_run?: string;
    next_run?: string;
    status?: 'idle' | 'running' | 'completed';
  }
): Promise<void> {
  const setClause: string[] = [];
  const values: (string | number)[] = [];
  
  if (updates.current_account_index !== undefined) {
    setClause.push('current_account_index = ?');
    values.push(updates.current_account_index);
  }
  if (updates.total_accounts !== undefined) {
    setClause.push('total_accounts = ?');
    values.push(updates.total_accounts);
  }
  if (updates.last_run !== undefined) {
    setClause.push('last_run = ?');
    values.push(updates.last_run);
  }
  if (updates.next_run !== undefined) {
    setClause.push('next_run = ?');
    values.push(updates.next_run);
  }
  if (updates.status !== undefined) {
    setClause.push('status = ?');
    values.push(updates.status);
  }
  
  if (setClause.length === 0) return;
  
  values.push(date);
  
  const query = `UPDATE cron_state SET ${setClause.join(', ')} WHERE date = ?`;
  await db.prepare(query).bind(...values).run();
}
