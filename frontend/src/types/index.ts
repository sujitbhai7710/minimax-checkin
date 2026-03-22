// Frontend types

// User types
export interface User {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
  last_login: string | null;
}

// MiniMax Account types
export interface MiniMaxAccount {
  id: number;
  user_id: number;
  account_name: string;
  cookies: string; // Masked on frontend
  current_credits: number;
  last_checkin: string | null;
  checkin_status: 'pending' | 'success' | 'failed';
  is_active: number;
  created_at: string;
  updated_at: string;
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

// System Stats
export interface SystemStats {
  totalAccounts: number;
  activeToday: number;
  pendingToday: number;
  failedToday: number;
  totalCredits: number;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Account form types
export interface AccountFormData {
  account_name: string;
  cookies: string;
}

export interface AccountUpdateData {
  account_name?: string;
  cookies?: string;
  is_active?: number;
}

// Dashboard data types
export interface DashboardData {
  accounts: MiniMaxAccount[];
  count: number;
}

export interface AccountDetailData {
  account: MiniMaxAccount;
  history: CheckinHistory[];
}

export interface StatusData {
  stats: SystemStats;
  cronState: CronState;
  currentTime: string;
  nextCheckIn: string | null;
}

export interface DailySummary {
  date: string;
  stats: {
    total_accounts: number;
    successful: number;
    failed: number;
    already_checked: number;
    total_credits_earned: number;
  };
  pendingAccounts: MiniMaxAccount[];
}
