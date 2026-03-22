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
  
  // Handle already-parsed JSON object
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
          if (cookie.name && cookie.value) {
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
      if (cookieObj.name && cookieObj.value) {
        cookies[cookieObj.name] = cookieObj.value;
        return cookies;
      }
    } catch (e) {
      // Not valid JSON, try other formats
    }
  }
  
  // Standard header string format: name=value; name2=value2
  cookieInput.split(';').forEach(cookie => {
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
export function validateCookiesFormat(cookieInput: string | unknown): { valid: boolean; error?: string; cookies?: string } {
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
  
  const cookies = parseCookies(cookieInput);
  const cookieString = cookiesToString(cookies);
  
  // Check if we have any cookies parsed
  if (Object.keys(cookies).length === 0) {
    return { valid: false, error: 'No valid cookies found. Please check the format.' };
  }
  
  // Check if we have the essential cookies
  if (!cookies['_token']) {
    return { valid: false, error: 'Missing _token cookie. Please make sure you are logged in to MiniMax.' };
  }
  
  return { valid: true, cookies: cookieString };
}

// Extract token from cookies
export function extractTokenFromCookies(cookieString: string): string | null {
  const cookies = parseCookies(cookieString);
  return cookies['_token'] || null;
}

// Fetch user info from MiniMax
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
  try {
    const response = await fetch('https://agent.minimax.io/api/user/info', {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://agent.minimax.io/',
        'Origin': 'https://agent.minimax.io'
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`
      };
    }

    const data = await response.json() as { 
      data?: { 
        id?: string;
        name?: string; 
        avatar?: string;
        email?: string;
      } 
    };
    
    if (data.data) {
      return {
        success: true,
        user: {
          id: data.data.id || '',
          name: data.data.name || 'Unknown',
          avatar: data.data.avatar || '',
          email: data.data.email
        }
      };
    }
    
    return { success: false, error: 'No user data returned' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Fetch user credits from MiniMax
export async function fetchCredits(cookies: string): Promise<MiniMaxCredits | null> {
  try {
    const response = await fetch('https://agent.minimax.io/api/user/credits', {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://agent.minimax.io/',
        'Origin': 'https://agent.minimax.io'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch credits:', response.status, response.statusText);
      return null;
    }

    const data = await response.json() as { data?: { total?: number; used?: number; remaining?: number } };
    
    if (data.data) {
      return {
        total: data.data.total || 0,
        used: data.data.used || 0,
        remaining: data.data.remaining || 0
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching credits:', error);
    return null;
  }
}

// Check if user has already checked in today
export async function checkTodayCheckin(cookies: string): Promise<{
  success: boolean;
  checkedIn?: boolean;
  error?: string;
}> {
  try {
    const response = await fetch('https://agent.minimax.io/api/checkin/status', {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://agent.minimax.io/',
        'Origin': 'https://agent.minimax.io'
      }
    });

    if (!response.ok) {
      // If endpoint doesn't exist, we'll check via the main check-in API
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json() as { 
      data?: { 
        checkedIn?: boolean;
        today?: boolean;
      } 
    };

    return {
      success: true,
      checkedIn: data.data?.checkedIn || data.data?.today || false
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Perform daily check-in
export async function performCheckin(cookies: string): Promise<MiniMaxCheckinResult> {
  try {
    const response = await fetch('https://agent.minimax.io/api/checkin', {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Referer': 'https://agent.minimax.io/',
        'Origin': 'https://agent.minimax.io'
      },
      body: JSON.stringify({})
    });

    const data = await response.json() as { 
      code?: number; 
      message?: string; 
      data?: { 
        credits?: number; 
        creditsEarned?: number;
        alreadyCheckedIn?: boolean;
      } 
    };

    if (response.ok && (data.code === 0 || data.code === 200)) {
      return {
        success: true,
        credits: data.data?.credits,
        creditsEarned: data.data?.creditsEarned || 0,
        alreadyCheckedIn: data.data?.alreadyCheckedIn || false
      };
    }

    // Check if already checked in today
    if (data.message?.includes('already') || data.message?.includes('已签到') || data.code === 1001) {
      return {
        success: true,
        alreadyCheckedIn: true
      };
    }

    return {
      success: false,
      error: data.message || `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
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
  error?: string;
  rawCookies?: string;
}> {
  // Validate and normalize cookies
  const validation = validateCookiesFormat(cookieInput);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  const cookies = validation.cookies!;
  
  // Fetch all data in parallel
  const [userInfo, credits] = await Promise.all([
    fetchUserInfo(cookies),
    fetchCredits(cookies)
  ]);
  
  if (!userInfo.success) {
    return {
      success: false,
      error: userInfo.error || 'Failed to fetch user info. Cookies may be expired.'
    };
  }
  
  // Try check-in to see if already done today
  const checkinResult = await performCheckin(cookies);
  
  return {
    success: true,
    user: userInfo.user,
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
    rawCookies: cookies
  };
}

// Validate cookies by making a test request
export async function validateCookies(cookieInput: string | unknown): Promise<{ valid: boolean; userName?: string; error?: string }> {
  const validation = validateCookiesFormat(cookieInput);
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }
  
  const userInfo = await fetchUserInfo(validation.cookies!);
  
  if (userInfo.success && userInfo.user) {
    return {
      valid: true,
      userName: userInfo.user.name
    };
  }
  
  return {
    valid: false,
    error: userInfo.error || 'Invalid cookies'
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
