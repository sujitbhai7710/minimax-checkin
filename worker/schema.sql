-- MiniMax Auto Check-in System Database Schema
-- For Cloudflare D1

-- Users table (for frontend login)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- MiniMax accounts table
CREATE TABLE IF NOT EXISTS minimax_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_name TEXT NOT NULL,
    cookies TEXT NOT NULL,  -- Encrypted cookies
    current_credits INTEGER DEFAULT 0,
    last_checkin DATETIME,
    checkin_status TEXT DEFAULT 'pending', -- pending, success, failed
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Check-in history table
CREATE TABLE IF NOT EXISTS checkin_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    checkin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL, -- success, failed, already_checked_in
    credits_before INTEGER,
    credits_after INTEGER,
    credits_earned INTEGER,
    error_message TEXT,
    FOREIGN KEY (account_id) REFERENCES minimax_accounts(id) ON DELETE CASCADE
);

-- Credit history table (tracks credit changes over time)
CREATE TABLE IF NOT EXISTS credit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    credits INTEGER NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES minimax_accounts(id) ON DELETE CASCADE
);

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type TEXT NOT NULL, -- info, warning, error
    account_id INTEGER,
    message TEXT NOT NULL,
    details TEXT, -- JSON details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES minimax_accounts(id) ON DELETE SET NULL
);

-- Cron state table (to track cron job progress)
CREATE TABLE IF NOT EXISTS cron_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, -- Date in YYYY-MM-DD format
    current_account_index INTEGER DEFAULT 0,
    total_accounts INTEGER DEFAULT 0,
    last_run DATETIME,
    next_run DATETIME,
    status TEXT DEFAULT 'idle', -- idle, running, completed
    UNIQUE(date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_user ON minimax_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_account ON checkin_history(account_id);
CREATE INDEX IF NOT EXISTS idx_checkin_time ON checkin_history(checkin_time);
CREATE INDEX IF NOT EXISTS idx_credit_account ON credit_history(account_id);
CREATE INDEX IF NOT EXISTS idx_cron_date ON cron_state(date);
