// Type definitions for MiniMax Check-in System

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  ENVIRONMENT: string;
}

// User types
export interface User {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
  last_login: string | null;
}

export interface UserCreate {
  email: string;
  password: string;
  name?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

// MiniMax Account types
export interface MiniMaxAccount {
  id: number;
  user_id: number;
  account_name: string;
  cookies: string;
  current_credits: number;
  last_checkin: string | null;
  checkin_status: 'pending' | 'success' | 'failed';
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface MiniMaxAccountCreate {
  account_name: string;
  cookies: string;
}

export interface MiniMaxAccountUpdate {
  account_name?: string;
  cookies?: string;
  is_active?: number;
}

// Check-in History types
export interface CheckinHistory {
  id: number;
  account_id: number;
  checkin_time: string;
  status: 'success' | 'failed' | 'already_checked_in';
  credits_before: number | null;
  credits_after: number | null;
  credits_earned: number | null;
  error_message: string | null;
}

// Credit History types
export interface CreditHistory {
  id: number;
  account_id: number;
  credits: number;
  recorded_at: string;
}

// System Log types
export interface SystemLog {
  id: number;
  log_type: 'info' | 'warning' | 'error';
  account_id: number | null;
  message: string;
  details: string | null;
  created_at: string;
}

// Cron State types
export interface CronState {
  id: number;
  date: string;
  current_account_index: number;
  total_accounts: number;
  last_run: string | null;
  next_run: string | null;
  status: 'idle' | 'running' | 'completed';
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// MiniMax API types
export interface MiniMaxUserInfo {
  id: string;
  name: string;
  avatar: string;
}

export interface MiniMaxCredits {
  total: number;
  used: number;
  remaining: number;
}

export interface MiniMaxCheckinResult {
  success: boolean;
  credits?: number;
  creditsEarned?: number;
  alreadyCheckedIn?: boolean;
  error?: string;
}

// JWT payload
export interface JwtPayload {
  userId: number;
  email: string;
  iat: number;
  exp: number;
}
