// MiniMax API utility functions

import { MiniMaxCheckinResult, MiniMaxCredits } from '../types';

// Parse cookies from multiple formats (string or already-parsed JSON)
export function parseCookies(cookieInput: string | unknown): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  // Handle already-parsed JSON array
  if (Array.isArray(cookieInput)) {
    for (const cookie of cookieInput) {
      if (cookie && typeof cookie === 'object' && 'name' in cookie && 'value' in cookie) {
        cookies[cookie.name as string] = cookie.value as string;
      }
    }
    return cookies;
  }
  
  // Handle already-parsed JSON object (single cookie)
  if (typeof cookieInput === 'object' && cookieInput !== null && 'name' in cookieInput && 'value' in cookieInput) {
    cookies[(cookieInput as { name: string }).name] = (cookieInput as { value: string }).value;
    return cookies;
  }
  
  // Handle string input
  if (typeof cookieInput !== 'string') {
    return cookies;
  }
  
  // Trim input
  const trimmed = cookieInput.trim();
  
  // Try to detect JSON format (array of cookie objects)
  if (trimmed.startsWith('[')) {
    try {
      const cookieArray = JSON.parse(trimmed);
      if (Array.isArray(cookieArray)) {
        for (const cookie of cookieArray) {
          if (cookie && typeof cookie === 'object' && cookie.name && cookie.value) {
            cookies[cookie.name] = cookie.value;
          }
        }
        return cookies;
      }
    } catch (e) {
      // Not valid JSON, try other formats
      console.log('Failed to parse JSON array cookies:', e);
    }
  }
  
  // Try to detect JSON format (single object)
  if (trimmed.startsWith('{')) {
    try {
      const cookieObj = JSON.parse(trimmed);
      if (cookieObj && typeof cookieObj === 'object' && cookieObj.name && cookieObj.value) {
        cookies[cookieObj.name] = cookieObj.value;
        return cookies;
      }
    } catch (e) {
      // Not valid JSON, try other formats
      console.log('Failed to parse JSON object cookies:', e);
    }
  }
  
  // Standard header string format: name=value; name2=value2
  trimmed.split(';').forEach(cookie => {
    const trimmedCookie = cookie.trim();
    const separatorIndex = trimmedCookie.indexOf('=');
    if (separatorIndex > 0) {
      const name = trimmedCookie.substring(0, separatorIndex).trim();
      const value = trimmedCookie.substring(separatorIndex + 1).trim();
      if (name && value) {
        cookies[name] = value;
      }
    }
  });
  
  return cookies;
}

// Convert cookies object to string
export function cookiesToString(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

// Normalize cookies input to string format
export function normalizeCookies(cookieInput: string | unknown): string {
  const cookies = parseCookies(cookieInput);
  return cookiesToString(cookies);
}

// Validate cookies format
export function validateCookiesFormat(cookieInput: string | unknown): { valid: boolean; error?: string; cookies?: string; parsedCookies?: Record<string, string> } {
  // Check for empty input
  if (!cookieInput) {
    return { valid: false, error: 'Cookies cannot be empty' };
  }
  
  // For string input, check if trimmed is empty
  if (typeof cookieInput === 'string' && cookieInput.trim() === '') {
    return { valid: false, error: 'Cookies cannot be empty' };
  }
  
  // For array input, check if array is empty
  if (Array.isArray(cookieInput) && cookieInput.length === 0) {
    return { valid: false, error: 'Cookies cannot be empty' };
  }
  
  const parsedCookies = parseCookies(cookieInput);
  const cookieString = cookiesToString(parsedCookies);
  
  // Check if we have any cookies parsed
  if (Object.keys(parsedCookies).length === 0) {
    return { valid: false, error: 'No valid cookies found. Please check the format.' };
  }
  
  // Check if we have the essential cookies
  if (!parsedCookies['_token']) {
    return { valid: false, error: 'Missing _token cookie. Please make sure you are logged in to MiniMax.' };
  }
  
  return { valid: true, cookies: cookieString, parsedCookies };
}

// Extract token from cookies
export function extractTokenFromCookies(cookieString: string): string | null {
  const cookies = parseCookies(cookieString);
  return cookies['_token'] || null;
}

// Decode JWT token payload (works in Cloudflare Workers)
function decodeJWT(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Decode the payload (middle part)
    const payload = parts[1];
    // Add padding if needed
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
    
    // Use Buffer for base64 decoding (works in Cloudflare Workers)
    const decoded = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    console.error('Failed to decode JWT:', e);
    return null;
  }
}

// Extract user info from JWT token directly (no API call needed)
export function extractUserInfoFromToken(cookieInput: string | unknown): {
  success: boolean;
  user?: {
    id: string;
    name: string;
    avatar: string;
    deviceID?: string;
    isAnonymous?: boolean;
  };
  tokenExpiry?: number;
  isExpired?: boolean;
  error?: string;
} {
  const validation = validateCookiesFormat(cookieInput);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  const token = validation.parsedCookies!['_token'];
  if (!token) {
    return { success: false, error: 'No _token found in cookies' };
  }
  
  const payload = decodeJWT(token);
  if (!payload) {
    return { success: false, error: 'Invalid JWT token format' };
  }
  
  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  const isExpired = payload.exp ? payload.exp < now : false;
  
  if (!payload.user) {
    return { success: false, error: 'No user info in token' };
  }
  
  return {
    success: true,
    user: {
      id: payload.user.id || '',
      name: payload.user.name || 'Unknown',
      avatar: payload.user.avatar || '',
      deviceID: payload.user.deviceID,
      isAnonymous: payload.user.isAnonymous
    },
    tokenExpiry: payload.exp,
    isExpired
  };
}

// Make API request with proper headers
async function makeAPIRequest(
  endpoint: string,
  cookies: string,
  method: string = 'GET',
  body?: any
): Promise<{ ok: boolean; status: number; data: any }> {
  const url = `https://agent.minimax.io${endpoint}`;
  
  console.log(`[MiniMax API] ${method} ${url}`);
  
  const headers: Record<string, string> = {
    'Cookie': cookies,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://agent.minimax.io/',
    'Origin': 'https://agent.minimax.io',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };
  
  if (method === 'POST' && body) {
    headers['Content-Type'] = 'application/json';
  }
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    const responseText = await response.text();
    console.log(`[MiniMax API] Response status: ${response.status}`);
    console.log(`[MiniMax API] Response body: ${responseText.substring(0, 500)}`);
    
    // Check if response is Cloudflare challenge
    if (responseText.includes('Just a moment') || responseText.includes('challenge')) {
      console.error('[MiniMax API] Cloudflare challenge detected');
      return {
        ok: false,
        status: 403,
        data: { error: 'Cloudflare challenge - cookies may need refresh' }
      };
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { rawText: responseText };
    }
    
    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    console.error(`[MiniMax API] Request failed:`, error);
    return {
      ok: false,
      status: 0,
      data: { error: error instanceof Error ? error.message : 'Network error' }
    };
  }
}

// Fetch user info - try multiple endpoints
export async function fetchUserInfo(cookies: string): Promise<{
  success: boolean;
  user?: {
    id: string;
    name: string;
    avatar: string;
    email?: string;
  };
  error?: string;
}> {
  // First, try to extract from JWT token
  const tokenInfo = extractUserInfoFromToken(cookies);
  if (tokenInfo.success && tokenInfo.user) {
    console.log('[MiniMax API] User info extracted from JWT token');
    return {
      success: true,
      user: tokenInfo.user
    };
  }
  
  // If token extraction fails, try API endpoints
  const endpoints = [
    '/api/user/info',
    '/api/user',
    '/api/v1/user/info',
    '/api/v1/user'
  ];
  
  for (const endpoint of endpoints) {
    const result = await makeAPIRequest(endpoint, cookies);
    if (result.ok && result.data) {
      const userData = result.data.data || result.data;
      if (userData.id || userData.name) {
        return {
          success: true,
          user: {
            id: userData.id || '',
            name: userData.name || 'Unknown',
            avatar: userData.avatar || '',
            email: userData.email
          }
        };
      }
    }
  }
  
  return {
    success: false,
    error: tokenInfo.error || 'Failed to fetch user info from all endpoints'
  };
}

// Fetch user credits - try multiple endpoints
export async function fetchCredits(cookies: string): Promise<MiniMaxCredits | null> {
  const endpoints = [
    '/api/user/credits',
    '/api/credits',
    '/api/user/balance',
    '/api/v1/user/credits',
    '/api/v1/credits'
  ];
  
  for (const endpoint of endpoints) {
    const result = await makeAPIRequest(endpoint, cookies);
    if (result.ok && result.data) {
      const creditData = result.data.data || result.data;
      if (creditData && (creditData.total !== undefined || creditData.remaining !== undefined || creditData.balance !== undefined)) {
        return {
          total: creditData.total || creditData.totalCredit || 0,
          used: creditData.used || creditData.usedCredit || 0,
          remaining: creditData.remaining || creditData.balance || creditData.creditBalance || 0
        };
      }
    }
  }
  
  console.error('[MiniMax API] Failed to fetch credits from all endpoints');
  return null;
}

// Check if user has already checked in today
export async function checkTodayCheckin(cookies: string): Promise<{
  success: boolean;
  checkedIn?: boolean;
  error?: string;
}> {
  const endpoints = [
    '/api/checkin/status',
    '/api/checkin',
    '/api/daily-reward/status',
    '/api/v1/checkin/status'
  ];
  
  for (const endpoint of endpoints) {
    const result = await makeAPIRequest(endpoint, cookies);
    if (result.ok && result.data) {
      const checkinData = result.data.data || result.data;
      return {
        success: true,
        checkedIn: checkinData.checkedIn || checkinData.today || checkinData.hasCheckedIn || false
      };
    }
  }
  
  return { success: false, error: 'Failed to check checkin status' };
}

// Perform daily check-in - try multiple endpoints
export async function performCheckin(cookies: string): Promise<MiniMaxCheckinResult> {
  const endpoints = [
    { path: '/api/checkin', method: 'POST' },
    { path: '/api/checkin/daily', method: 'POST' },
    { path: '/api/daily-reward', method: 'POST' },
    { path: '/api/daily-reward/claim', method: 'POST' },
    { path: '/api/v1/checkin', method: 'POST' },
    { path: '/api/user/checkin', method: 'POST' }
  ];
  
  for (const { path, method } of endpoints) {
    const result = await makeAPIRequest(path, cookies, method, {});
    
    if (result.ok || result.status === 200) {
      const checkinData = result.data.data || result.data;
      
      // Check for success
      if (result.data.code === 0 || result.data.code === 200 || result.data.success) {
        return {
          success: true,
          credits: checkinData.credits || checkinData.creditBalance,
          creditsEarned: checkinData.creditsEarned || checkinData.reward || 200,
          alreadyCheckedIn: false
        };
      }
      
      // Check if already checked in
      if (result.data.message?.includes('already') || 
          result.data.message?.includes('已签到') || 
          result.data.code === 1001 ||
          checkinData.alreadyCheckedIn) {
        return {
          success: true,
          alreadyCheckedIn: true
        };
      }
    }
    
    // Check for "already checked in" in error responses
    if (result.data.message?.includes('already') || result.data.code === 1001) {
      return {
        success: true,
        alreadyCheckedIn: true
      };
    }
  }
  
  return {
    success: false,
    error: 'Check-in failed on all endpoints. API may require browser session.'
  };
}

// Comprehensive test function - returns all available data
export async function testCookies(cookieInput: string | unknown): Promise<{
  success: boolean;
  user?: {
    id: string;
    name: string;
    avatar: string;
  };
  credits?: {
    total: number;
    used: number;
    remaining: number;
  };
  checkin?: {
    canCheckin: boolean;
    alreadyCheckedIn: boolean;
    message: string;
  };
  tokenInfo?: {
    expiry: number;
    expiryDate: string;
    isExpired: boolean;
  };
  error?: string;
  rawCookies?: string;
}> {
  // Validate and normalize cookies
  const validation = validateCookiesFormat(cookieInput);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  const cookies = validation.cookies!;
  
  // Extract user info from JWT token
  const tokenInfo = extractUserInfoFromToken(cookies);
  
  if (!tokenInfo.success) {
    return {
      success: false,
      error: tokenInfo.error || 'Invalid token'
    };
  }
  
  // Get token expiry info
  const tokenExpiryInfo = tokenInfo.tokenExpiry ? {
    expiry: tokenInfo.tokenExpiry,
    expiryDate: new Date(tokenInfo.tokenExpiry * 1000).toISOString(),
    isExpired: tokenInfo.isExpired || false
  } : undefined;
  
  // If token is expired, return error
  if (tokenInfo.isExpired) {
    return {
      success: false,
      error: 'Token has expired. Please get fresh cookies from MiniMax.',
      tokenInfo: tokenExpiryInfo
    };
  }
  
  // Try to fetch credits (may fail due to Cloudflare)
  const credits = await fetchCredits(cookies);
  
  // Try check-in
  const checkinResult = await performCheckin(cookies);
  
  return {
    success: true,
    user: tokenInfo.user,
    credits: credits || { total: 0, used: 0, remaining: 0 },
    checkin: {
      canCheckin: !checkinResult.alreadyCheckedIn && checkinResult.success,
      alreadyCheckedIn: checkinResult.alreadyCheckedIn || false,
      message: checkinResult.alreadyCheckedIn 
        ? 'Already checked in today' 
        : checkinResult.success 
          ? 'Check-in available' 
          : checkinResult.error || 'Unknown status'
    },
    tokenInfo: tokenExpiryInfo,
    rawCookies: cookies
  };
}

// Validate cookies by making a test request
export async function validateCookies(cookieInput: string | unknown): Promise<{ valid: boolean; userName?: string; error?: string }> {
  const validation = validateCookiesFormat(cookieInput);
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }
  
  const tokenInfo = extractUserInfoFromToken(validation.cookies!);
  
  if (tokenInfo.success && tokenInfo.user) {
    if (tokenInfo.isExpired) {
      return { valid: false, error: 'Token has expired' };
    }
    return {
      valid: true,
      userName: tokenInfo.user.name
    };
  }
  
  return {
    valid: false,
    error: tokenInfo.error || 'Invalid cookies'
  };
}

// Complete check-in flow with credit update
export async function completeCheckinFlow(
  cookies: string
): Promise<{ 
  success: boolean; 
  credits?: number; 
  creditsEarned?: number;
  alreadyCheckedIn?: boolean;
  error?: string;
}> {
  // Get current credits before check-in
  const creditsBefore = await fetchCredits(cookies);
  
  // Perform check-in
  const checkinResult = await performCheckin(cookies);
  
  if (!checkinResult.success) {
    return {
      success: false,
      error: checkinResult.error
    };
  }

  // Get credits after check-in
  const creditsAfter = await fetchCredits(cookies);
  
  return {
    success: true,
    credits: creditsAfter?.remaining || creditsBefore?.remaining || 0,
    creditsEarned: checkinResult.creditsEarned || (creditsAfter && creditsBefore ? creditsAfter.remaining - creditsBefore.remaining : 0),
    alreadyCheckedIn: checkinResult.alreadyCheckedIn
  };
}
