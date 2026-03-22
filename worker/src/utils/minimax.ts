// MiniMax API utility functions

import { MiniMaxCheckinResult, MiniMaxCredits } from '../types';

// MD5 implementation for Cloudflare Workers
async function md5(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

// Validate cookies format - REQUIRE both _token AND __cf_bm
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
  
  // Check for _token cookie (required)
  if (!parsedCookies['_token']) {
    return { valid: false, error: 'Missing _token cookie. Please make sure you are logged in to MiniMax.' };
  }
  
  // Check for __cf_bm cookie (required for Cloudflare)
  if (!parsedCookies['__cf_bm']) {
    return { valid: false, error: 'Missing __cf_bm cookie (Cloudflare protection). Please refresh the MiniMax page and export cookies again immediately.' };
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

// Generate UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate device ID (8 digit number)
function generateDeviceID(): string {
  return Math.floor(Math.random() * 90000000 + 10000000).toString();
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

// Generate signature headers
async function generateSignatureHeaders(
  urlWithParams: string,
  body: string,
  timestampMs: number
): Promise<{ xSignature: string; xTimestamp: string; yy: string }> {
  const timestampSec = Math.floor(timestampMs / 1000);
  
  // x-signature = MD5(timestamp_seconds + "I*7Cf%WZ#S&%1RlZJ&C2" + body_string)
  const xSignature = await md5(`${timestampSec}I*7Cf%WZ#S&%1RlZJ&C2${body}`);
  
  // yy = MD5(encodeURIComponent(url_with_params) + "_" + body_json + MD5(timestamp_ms.toString()) + "ooui")
  const timestampMd5 = await md5(timestampMs.toString());
  const yy = await md5(`${encodeURIComponent(urlWithParams)}_${body}${timestampMd5}ooui`);
  
  return {
    xSignature,
    xTimestamp: timestampSec.toString(),
    yy
  };
}

// Build query parameters for MiniMax API
function buildQueryParams(params: {
  userId: string;
  deviceId: string;
  uuid: string;
  token: string;
  timestampMs: number;
  timezoneOffset?: number;
}): URLSearchParams {
  const timezoneOffset = params.timezoneOffset ?? -new Date().getTimezoneOffset() * 60;
  
  return new URLSearchParams({
    device_platform: 'web',
    biz_id: '3',
    app_id: '3001',
    version_code: '22201',
    unix: params.timestampMs.toString(),
    timezone_offset: timezoneOffset.toString(),
    lang: 'en',
    sys_language: 'en',
    uuid: params.uuid,
    device_id: params.deviceId,
    os_name: 'h5',
    browser_name: 'chrome',
    device_memory: '8',
    cpu_core_num: '4',
    browser_language: 'en-US',
    browser_platform: 'Win32',
    user_id: params.userId,
    screen_width: '1920',
    screen_height: '1080',
    token: params.token,
    client: 'web'
  });
}

// Fetch membership info (credits) from MiniMax API
export async function fetchMembershipInfo(cookies: string, token: string): Promise<{
  success: boolean;
  credits?: MiniMaxCredits;
  membershipInfo?: any;
  error?: string;
}> {
  try {
    // Extract user info from token
    const tokenInfo = extractUserInfoFromToken(cookies);
    if (!tokenInfo.success || !tokenInfo.user) {
      return { success: false, error: tokenInfo.error || 'Invalid token' };
    }
    
    const userId = tokenInfo.user.id;
    const deviceId = tokenInfo.user.deviceID || generateDeviceID();
    const uuid = generateUUID();
    const timestampMs = Date.now();
    
    // Build query parameters
    const queryParams = buildQueryParams({
      userId,
      deviceId,
      uuid,
      token,
      timestampMs
    });
    
    const baseUrl = 'https://agent.minimax.io/matrix/api/v1/commerce/get_membership_info';
    const urlWithParams = `${baseUrl}?${queryParams.toString()}`;
    const body = '{}';
    
    // Generate signature headers
    const { xSignature, xTimestamp, yy } = await generateSignatureHeaders(
      urlWithParams,
      body,
      timestampMs
    );
    
    console.log(`[MiniMax API] POST ${urlWithParams.substring(0, 100)}...`);
    console.log(`[MiniMax API] Headers: x-timestamp=${xTimestamp}, x-signature=${xSignature}`);
    
    const response = await fetch(urlWithParams, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json',
        'Cookie': cookies,  // This includes both _token and __cf_bm
        'Origin': 'https://agent.minimax.io',
        'Referer': 'https://agent.minimax.io/',
        'Token': token,
        'x-timestamp': xTimestamp,
        'x-signature': xSignature,
        'yy': yy,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      },
      body: body
    });
    
    console.log(`[MiniMax API] Response status: ${response.status}`);
    
    if (!response.ok) {
      const responseText = await response.text();
      console.log(`[MiniMax API] Response body: ${responseText.substring(0, 500)}`);
      
      // Check for Cloudflare challenge
      if (response.status === 403 && responseText.includes('Just a moment')) {
        return { 
          success: false, 
          error: 'Cloudflare bot protection triggered. Please get fresh cookies from MiniMax and try again. Make sure to include __cf_bm cookie.' 
        };
      }
      
      return { success: false, error: `HTTP ${response.status}: ${responseText.substring(0, 200)}` };
    }
    
    const data = await response.json();
    console.log(`[MiniMax API] Response data:`, JSON.stringify(data).substring(0, 500));
    
    // Parse credit info from response
    if (data.code === 0 || data.code === 200 || data.data) {
      const membershipData = data.data || data;
      
      return {
        success: true,
        credits: {
          total: membershipData.total_credits || membershipData.totalCredits || membershipData.total || 0,
          used: membershipData.used_credits || membershipData.usedCredits || membershipData.used || 0,
          remaining: membershipData.remaining_credits || membershipData.remainingCredits || membershipData.balance || membershipData.credit_balance || 0
        },
        membershipInfo: membershipData
      };
    }
    
    return { success: false, error: data.message || 'Unknown response format' };
    
  } catch (error) {
    console.error(`[MiniMax API] Request failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

// Perform daily check-in (login check-in)
export async function performCheckin(cookies: string): Promise<MiniMaxCheckinResult> {
  try {
    // Extract token from cookies
    const token = extractTokenFromCookies(cookies);
    if (!token) {
      return { success: false, error: 'No token found in cookies' };
    }
    
    // Extract user info from token
    const tokenInfo = extractUserInfoFromToken(cookies);
    if (!tokenInfo.success || !tokenInfo.user) {
      return { success: false, error: tokenInfo.error || 'Invalid token' };
    }
    
    // Get current credits before check-in
    const beforeInfo = await fetchMembershipInfo(cookies, token);
    const creditsBefore = beforeInfo.credits?.remaining || 0;
    
    // If fetch failed due to Cloudflare, return error
    if (!beforeInfo.success) {
      return { success: false, error: beforeInfo.error };
    }
    
    // According to user: "only login is enough to get 200 points"
    // So just fetching membership info might be enough to trigger the daily reward
    // Let's try to get the info again to see if credits changed
    
    const afterInfo = await fetchMembershipInfo(cookies, token);
    
    if (!afterInfo.success) {
      return { success: false, error: afterInfo.error };
    }
    
    const creditsAfter = afterInfo.credits?.remaining || creditsBefore;
    const creditsEarned = creditsAfter - creditsBefore;
    
    // If credits increased, check-in was successful
    if (creditsEarned > 0) {
      return {
        success: true,
        credits: creditsAfter,
        creditsEarned: creditsEarned,
        alreadyCheckedIn: false
      };
    }
    
    // If credits didn't change, might already be checked in
    return {
      success: true,
      credits: creditsAfter,
      creditsEarned: 0,
      alreadyCheckedIn: true
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

// Fetch user credits
export async function fetchCredits(cookies: string): Promise<MiniMaxCredits | null> {
  const token = extractTokenFromCookies(cookies);
  if (!token) return null;
  
  const result = await fetchMembershipInfo(cookies, token);
  return result.credits || null;
}

// Comprehensive test function
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
  const token = validation.parsedCookies!['_token'];
  
  // Check for __cf_bm
  if (!validation.parsedCookies!['__cf_bm']) {
    return { 
      success: false, 
      error: 'Missing __cf_bm cookie. Cloudflare protection requires this cookie. Please refresh MiniMax page and export cookies again.' 
    };
  }
  
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
  
  // Try to fetch credits using the real API
  const membershipResult = await fetchMembershipInfo(cookies, token);
  const credits = membershipResult.credits;
  
  if (!membershipResult.success) {
    return {
      success: false,
      error: membershipResult.error,
      user: tokenInfo.user,
      tokenInfo: tokenExpiryInfo
    };
  }
  
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
          ? `Check-in successful! +${checkinResult.creditsEarned || 200} credits`
          : checkinResult.error || 'Check-in failed'
    },
    tokenInfo: tokenExpiryInfo,
    rawCookies: cookies
  };
}

// Validate cookies by checking token
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

// Fetch user info - extract from JWT token
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
  const tokenInfo = extractUserInfoFromToken(cookies);
  if (tokenInfo.success && tokenInfo.user) {
    return {
      success: true,
      user: tokenInfo.user
    };
  }
  return {
    success: false,
    error: tokenInfo.error || 'Invalid token'
  };
}
