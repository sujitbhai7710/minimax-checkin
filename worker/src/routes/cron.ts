// Cron job handler for automated check-ins

import { Env } from '../types';
import { 
  getAllActiveAccounts, 
  getCronState, 
  createOrUpdateCronState, 
  updateCronState,
  updateAccountCredits,
  createCheckinHistory,
  createCreditHistory,
  createLog
} from '../utils/db';
import { decrypt } from '../utils/crypto';
import { completeCheckinFlow, fetchCredits } from '../utils/minimax';

// Helper to get current time in IST
function getISTTime(): Date {
  const now = new Date();
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
}

// Check if current time is within check-in window (5:30 AM IST onwards)
function isWithinCheckinWindow(): boolean {
  const istTime = getISTTime();
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const currentTimeInMinutes = hours * 60 + minutes;
  
  // Start from 5:30 AM IST (330 minutes from midnight)
  const startWindow = 5 * 60 + 30; // 330 minutes
  
  return currentTimeInMinutes >= startWindow;
}

// Calculate next run time (30 minutes from now)
function calculateNextRunTime(): string {
  const next = new Date(Date.now() + 30 * 60 * 1000);
  return next.toISOString();
}

// Main cron handler
export async function handleCron(env: Env): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const istTime = getISTTime();
  
  console.log(`[CRON] Starting cron job at ${istTime.toISOString()} IST`);
  
  // Check if within check-in window
  if (!isWithinCheckinWindow()) {
    console.log('[CRON] Outside check-in window. Waiting until 5:30 AM IST.');
    return;
  }
  
  // Get all active accounts
  const accounts = await getAllActiveAccounts(env.DB);
  
  if (accounts.length === 0) {
    console.log('[CRON] No active accounts found');
    return;
  }
  
  // Get or create cron state
  let cronState = await getCronState(env.DB, today);
  
  if (!cronState) {
    cronState = await createOrUpdateCronState(env.DB, today, accounts.length);
  }
  
  // If already completed for today, skip
  if (cronState.status === 'completed') {
    console.log('[CRON] All accounts already processed for today');
    return;
  }
  
  // If running, check if stuck (more than 5 minutes since last run)
  if (cronState.status === 'running' && cronState.last_run) {
    const lastRun = new Date(cronState.last_run);
    const timeSinceLastRun = Date.now() - lastRun.getTime();
    
    if (timeSinceLastRun < 5 * 60 * 1000) {
      console.log('[CRON] Another cron job is running. Skipping.');
      return;
    }
    
    // Reset if stuck
    console.log('[CRON] Previous cron job appears stuck. Resetting.');
  }
  
  // Mark as running
  await updateCronState(env.DB, today, {
    status: 'running',
    total_accounts: accounts.length,
    last_run: new Date().toISOString()
  });
  
  // Get current account to process
  const currentIndex = cronState.current_account_index;
  
  if (currentIndex >= accounts.length) {
    // All accounts processed
    await updateCronState(env.DB, today, {
      status: 'completed',
      next_run: null
    });
    
    await createLog(env.DB, 'info', 'All accounts processed for today');
    console.log('[CRON] All accounts processed for today');
    return;
  }
  
  const account = accounts[currentIndex];
  console.log(`[CRON] Processing account ${currentIndex + 1}/${accounts.length}: ${account.account_name}`);
  
  try {
    // Decrypt cookies
    const cookies = await decrypt(account.cookies, env.ENCRYPTION_KEY);
    
    // Get current credits
    const creditsBefore = await fetchCredits(cookies);
    const creditsBeforeValue = creditsBefore?.remaining || 0;
    
    // Perform check-in
    const result = await completeCheckinFlow(cookies);
    
    if (result.success) {
      // Update account
      await updateAccountCredits(
        env.DB, 
        account.id, 
        result.credits || creditsBeforeValue, 
        result.alreadyCheckedIn ? 'success' : 'success'
      );
      
      // Create history
      await createCheckinHistory(
        env.DB,
        account.id,
        result.alreadyCheckedIn ? 'already_checked_in' : 'success',
        creditsBeforeValue,
        result.credits || creditsBeforeValue,
        result.creditsEarned || 0,
        null
      );
      
      // Save credit history
      await createCreditHistory(env.DB, account.id, result.credits || creditsBeforeValue);
      
      await createLog(
        env.DB, 
        'info', 
        result.alreadyCheckedIn 
          ? `Account "${account.account_name}" already checked in today` 
          : `Account "${account.account_name}" check-in successful. Credits earned: ${result.creditsEarned}`, 
        account.id
      );
      
      console.log(`[CRON] Account ${account.account_name} processed successfully`);
    } else {
      // Update account status
      await updateAccountCredits(env.DB, account.id, creditsBeforeValue, 'failed');
      
      // Create history
      await createCheckinHistory(
        env.DB,
        account.id,
        'failed',
        creditsBeforeValue,
        null,
        null,
        result.error || 'Unknown error'
      );
      
      await createLog(
        env.DB, 
        'error', 
        `Account "${account.account_name}" check-in failed: ${result.error}`, 
        account.id,
        JSON.stringify({ error: result.error })
      );
      
      console.log(`[CRON] Account ${account.account_name} failed: ${result.error}`);
    }
    
    // Update cron state for next run
    const nextIndex = currentIndex + 1;
    const isComplete = nextIndex >= accounts.length;
    
    await updateCronState(env.DB, today, {
      current_account_index: nextIndex,
      status: isComplete ? 'completed' : 'idle',
      next_run: isComplete ? null : calculateNextRunTime()
    });
    
  } catch (error) {
    console.error(`[CRON] Error processing account ${account.account_name}:`, error);
    
    await createLog(
      env.DB, 
      'error', 
      `Account "${account.account_name}" processing error: ${error}`, 
      account.id
    );
    
    // Move to next account even on error
    await updateCronState(env.DB, today, {
      current_account_index: currentIndex + 1,
      next_run: calculateNextRunTime()
    });
  }
}

// HTTP handler for cron endpoint
export async function handleCronRequest(request: Request, env: Env): Promise<Response> {
  // Verify this is a valid cron request or manual trigger
  const url = new URL(request.url);
  
  // For Cloudflare scheduled events, check for CF-Connecting-IP or similar
  // For manual triggers, we can add authentication later
  
  try {
    await handleCron(env);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Cron job executed',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
