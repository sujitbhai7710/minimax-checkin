// MiniMax Account routes

import { Hono } from 'hono';
import { Env, MiniMaxAccount, MiniMaxAccountCreate, MiniMaxAccountUpdate, ApiResponse } from '../types';
import { 
  getAccountsByUserId, 
  getAccountById, 
  createAccount, 
  updateAccount, 
  deleteAccount,
  getCheckinHistory,
  updateAccountCredits,
  createCheckinHistory,
  createCreditHistory,
  createLog
} from '../utils/db';
import { encrypt, decrypt } from '../utils/crypto';
import { getCurrentUser } from '../utils/middleware';
import { validateCookies, fetchCredits, completeCheckinFlow, testCookies, normalizeCookies } from '../utils/minimax';

const accountRoutes = new Hono<{ Bindings: Env }>();

// Test cookies endpoint (before adding account)
accountRoutes.post('/test', async (c) => {
  const body = await c.req.json<{ cookies: string }>();
  const { cookies } = body;
  
  if (!cookies) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Cookies are required'
    }, 400);
  }
  
  const result = await testCookies(cookies);
  
  if (!result.success) {
    return c.json<ApiResponse>({
      success: false,
      error: result.error || 'Invalid cookies'
    }, 400);
  }
  
  return c.json<ApiResponse<{
    user: typeof result.user;
    credits: typeof result.credits;
    checkin: typeof result.checkin;
  }>>({
    success: true,
    data: {
      user: result.user,
      credits: result.credits,
      checkin: result.checkin
    },
    message: 'Cookies are valid!'
  });
});

// Get all accounts for current user
accountRoutes.get('/', async (c) => {
  const user = getCurrentUser(c);
  const accounts = await getAccountsByUserId(c.env.DB, user.userId);
  
  // Decrypt cookies for display (partially masked)
  const accountsWithMaskedCookies = accounts.map(acc => ({
    ...acc,
    cookies: acc.cookies ? '******' : '' // Don't expose actual cookies
  }));
  
  return c.json<ApiResponse<{ accounts: typeof accountsWithMaskedCookies; count: number }>>({
    success: true,
    data: {
      accounts: accountsWithMaskedCookies,
      count: accounts.length
    }
  });
});

// Get single account with history
accountRoutes.get('/:id', async (c) => {
  const user = getCurrentUser(c);
  const accountId = parseInt(c.req.param('id'));
  
  if (isNaN(accountId)) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Invalid account ID'
    }, 400);
  }
  
  const account = await getAccountById(c.env.DB, accountId, user.userId);
  
  if (!account) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Account not found'
    }, 404);
  }
  
  // Get check-in history
  const history = await getCheckinHistory(c.env.DB, accountId, 30);
  
  return c.json<ApiResponse<{ 
    account: Omit<MiniMaxAccount, 'cookies'> & { cookies: string }; 
    history: typeof history 
  }>>({
    success: true,
    data: {
      account: {
        ...account,
        cookies: '******' // Mask cookies
      },
      history
    }
  });
});

// Add new account
accountRoutes.post('/', async (c) => {
  const user = getCurrentUser(c);
  const body = await c.req.json<MiniMaxAccountCreate>();
  const { account_name, cookies } = body;
  
  // Validate input
  if (!account_name || !cookies) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Account name and cookies are required'
    }, 400);
  }
  
  // Test cookies first
  const testResult = await testCookies(cookies);
  
  if (!testResult.success) {
    return c.json<ApiResponse>({
      success: false,
      error: `Invalid cookies: ${testResult.error}`
    }, 400);
  }
  
  // Normalize cookies to string format
  const normalizedCookies = testResult.rawCookies || normalizeCookies(cookies);
  
  // Encrypt cookies
  const encryptedCookies = await encrypt(normalizedCookies, c.env.ENCRYPTION_KEY);
  
  // Get initial credits from test result
  const initialCredits = testResult.credits?.remaining || 0;
  
  try {
    const account = await createAccount(
      c.env.DB, 
      user.userId, 
      account_name, 
      encryptedCookies
    );
    
    // Update initial credits
    await updateAccountCredits(c.env.DB, account.id, initialCredits, 'pending');
    
    // Log
    await createLog(c.env.DB, 'info', `Account "${account_name}" added`, account.id);
    
    // Save initial credit history
    await createCreditHistory(c.env.DB, account.id, initialCredits);
    
    return c.json<ApiResponse<{ 
      account: Omit<MiniMaxAccount, 'cookies'>; 
      userName: string | undefined;
      initialCredits: number;
      checkinStatus: typeof testResult.checkin;
    }>>({
      success: true,
      data: {
        account: {
          id: account.id,
          user_id: account.user_id,
          account_name: account.account_name,
          cookies: '******',
          current_credits: initialCredits,
          last_checkin: account.last_checkin,
          checkin_status: account.checkin_status,
          is_active: account.is_active,
          created_at: account.created_at,
          updated_at: account.updated_at
        },
        userName: testResult.user?.name,
        initialCredits,
        checkinStatus: testResult.checkin
      },
      message: 'Account added successfully'
    }, 201);
  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to add account'
    }, 500);
  }
});

// Update account
accountRoutes.put('/:id', async (c) => {
  const user = getCurrentUser(c);
  const accountId = parseInt(c.req.param('id'));
  const body = await c.req.json<MiniMaxAccountUpdate>();
  
  if (isNaN(accountId)) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Invalid account ID'
    }, 400);
  }
  
  // Check account exists
  const existingAccount = await getAccountById(c.env.DB, accountId, user.userId);
  if (!existingAccount) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Account not found'
    }, 404);
  }
  
  // Prepare updates
  const updates: MiniMaxAccountUpdate = {};
  
  if (body.account_name) {
    updates.account_name = body.account_name;
  }
  
  if (body.cookies) {
    // Test new cookies
    const testResult = await testCookies(body.cookies);
    if (!testResult.success) {
      return c.json<ApiResponse>({
        success: false,
        error: `Invalid cookies: ${testResult.error}`
      }, 400);
    }
    
    // Normalize and encrypt new cookies
    const normalizedCookies = testResult.rawCookies || normalizeCookies(body.cookies);
    updates.cookies = await encrypt(normalizedCookies, c.env.ENCRYPTION_KEY);
  }
  
  if (body.is_active !== undefined) {
    updates.is_active = body.is_active;
  }
  
  try {
    const updatedAccount = await updateAccount(c.env.DB, accountId, user.userId, updates);
    
    await createLog(c.env.DB, 'info', `Account "${existingAccount.account_name}" updated`, accountId);
    
    return c.json<ApiResponse<{ account: Omit<MiniMaxAccount, 'cookies'> }>>({
      success: true,
      data: {
        account: {
          ...updatedAccount!,
          cookies: '******'
        }
      },
      message: 'Account updated successfully'
    });
  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to update account'
    }, 500);
  }
});

// Delete account
accountRoutes.delete('/:id', async (c) => {
  const user = getCurrentUser(c);
  const accountId = parseInt(c.req.param('id'));
  
  if (isNaN(accountId)) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Invalid account ID'
    }, 400);
  }
  
  // Check account exists
  const existingAccount = await getAccountById(c.env.DB, accountId, user.userId);
  if (!existingAccount) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Account not found'
    }, 404);
  }
  
  try {
    await deleteAccount(c.env.DB, accountId, user.userId);
    
    await createLog(c.env.DB, 'info', `Account "${existingAccount.account_name}" deleted`);
    
    return c.json<ApiResponse>({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to delete account'
    }, 500);
  }
});

// Manual check-in for single account
accountRoutes.post('/:id/checkin', async (c) => {
  const user = getCurrentUser(c);
  const accountId = parseInt(c.req.param('id'));
  
  if (isNaN(accountId)) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Invalid account ID'
    }, 400);
  }
  
  const account = await getAccountById(c.env.DB, accountId, user.userId);
  if (!account) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Account not found'
    }, 404);
  }
  
  // Decrypt cookies
  const cookies = await decrypt(account.cookies, c.env.ENCRYPTION_KEY);
  
  // Get current credits
  const creditsBefore = await fetchCredits(cookies);
  const creditsBeforeValue = creditsBefore?.remaining || 0;
  
  // Perform check-in
  const result = await completeCheckinFlow(cookies);
  
  if (result.success) {
    // Update account
    await updateAccountCredits(c.env.DB, accountId, result.credits || creditsBeforeValue, 'success');
    
    // Create history
    await createCheckinHistory(
      c.env.DB,
      accountId,
      result.alreadyCheckedIn ? 'already_checked_in' : 'success',
      creditsBeforeValue,
      result.credits || creditsBeforeValue,
      result.creditsEarned || 0,
      null
    );
    
    // Save credit history
    await createCreditHistory(c.env.DB, accountId, result.credits || creditsBeforeValue);
    
    await createLog(
      c.env.DB, 
      'info', 
      result.alreadyCheckedIn ? 'Already checked in today' : 'Check-in successful', 
      accountId
    );
    
    return c.json<ApiResponse<{
      success: boolean;
      alreadyCheckedIn: boolean;
      creditsBefore: number;
      creditsAfter: number;
      creditsEarned: number;
    }>>({
      success: true,
      data: {
        success: true,
        alreadyCheckedIn: result.alreadyCheckedIn || false,
        creditsBefore: creditsBeforeValue,
        creditsAfter: result.credits || creditsBeforeValue,
        creditsEarned: result.creditsEarned || 0
      },
      message: result.alreadyCheckedIn ? 'Already checked in today' : 'Check-in successful'
    });
  } else {
    // Update account status
    await updateAccountCredits(c.env.DB, accountId, creditsBeforeValue, 'failed');
    
    // Create history
    await createCheckinHistory(
      c.env.DB,
      accountId,
      'failed',
      creditsBeforeValue,
      null,
      null,
      result.error || 'Unknown error'
    );
    
    await createLog(c.env.DB, 'error', `Check-in failed: ${result.error}`, accountId);
    
    return c.json<ApiResponse>({
      success: false,
      error: result.error || 'Check-in failed'
    }, 400);
  }
});

// Refresh credits for account
accountRoutes.post('/:id/refresh', async (c) => {
  const user = getCurrentUser(c);
  const accountId = parseInt(c.req.param('id'));
  
  if (isNaN(accountId)) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Invalid account ID'
    }, 400);
  }
  
  const account = await getAccountById(c.env.DB, accountId, user.userId);
  if (!account) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Account not found'
    }, 404);
  }
  
  // Decrypt cookies
  const cookies = await decrypt(account.cookies, c.env.ENCRYPTION_KEY);
  
  // Fetch credits
  const credits = await fetchCredits(cookies);
  
  if (!credits) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch credits. Cookies may be expired.'
    }, 400);
  }
  
  // Update account
  await updateAccountCredits(c.env.DB, accountId, credits.remaining, account.checkin_status);
  
  // Save credit history
  await createCreditHistory(c.env.DB, accountId, credits.remaining);
  
  return c.json<ApiResponse<{ credits: typeof credits }>>({
    success: true,
    data: { credits },
    message: 'Credits refreshed successfully'
  });
});

// Test existing account cookies
accountRoutes.post('/:id/test', async (c) => {
  const user = getCurrentUser(c);
  const accountId = parseInt(c.req.param('id'));
  
  if (isNaN(accountId)) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Invalid account ID'
    }, 400);
  }
  
  const account = await getAccountById(c.env.DB, accountId, user.userId);
  if (!account) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Account not found'
    }, 404);
  }
  
  // Decrypt cookies
  const cookies = await decrypt(account.cookies, c.env.ENCRYPTION_KEY);
  
  // Test cookies
  const result = await testCookies(cookies);
  
  if (!result.success) {
    return c.json<ApiResponse>({
      success: false,
      error: result.error || 'Cookies are expired or invalid'
    }, 400);
  }
  
  return c.json<ApiResponse<{
    user: typeof result.user;
    credits: typeof result.credits;
    checkin: typeof result.checkin;
  }>>({
    success: true,
    data: {
      user: result.user,
      credits: result.credits,
      checkin: result.checkin
    },
    message: 'Account is valid!'
  });
});

export default accountRoutes;
