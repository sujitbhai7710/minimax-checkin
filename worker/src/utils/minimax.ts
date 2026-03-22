// MiniMax API utility functions

import { MiniMaxCheckinResult, MiniMaxCredits } from '../types';

// Parse cookies string to object
export function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieString.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name.trim()] = value.trim();
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

// Extract token from cookies
export function extractTokenFromCookies(cookieString: string): string | null {
  const cookies = parseCookies(cookieString);
  return cookies['_token'] || null;
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

// Perform daily check-in
export async function performCheckin(cookies: string): Promise<MiniMaxCheckinResult> {
  try {
    // First, try to get the current page to find check-in button
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

    if (response.ok && data.code === 0) {
      return {
        success: true,
        credits: data.data?.credits,
        creditsEarned: data.data?.creditsEarned || 0,
        alreadyCheckedIn: data.data?.alreadyCheckedIn || false
      };
    }

    // Check if already checked in today
    if (data.message?.includes('already') || data.code === 1001) {
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

// Alternative check-in method using direct page access
export async function performCheckinViaPage(cookies: string): Promise<MiniMaxCheckinResult> {
  try {
    // Fetch the main page to check for check-in availability
    const pageResponse = await fetch('https://agent.minimax.io/', {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!pageResponse.ok) {
      return {
        success: false,
        error: `Failed to access page: ${pageResponse.status}`
      };
    }

    // Check if cookies are valid by looking for user info
    const html = await pageResponse.text();
    
    // If we're redirected to login, cookies are invalid
    if (html.includes('/login') || html.includes('sign in')) {
      return {
        success: false,
        error: 'Cookies expired or invalid'
      };
    }

    // Try to perform check-in via API
    const checkinResult = await performCheckin(cookies);
    
    // If API check-in doesn't work, try to extract check-in info from page
    if (!checkinResult.success && !checkinResult.alreadyCheckedIn) {
      // Look for check-in button status in HTML
      if (html.includes('checked in') || html.includes('already checked')) {
        return {
          success: true,
          alreadyCheckedIn: true
        };
      }
    }

    return checkinResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Validate cookies by making a test request
export async function validateCookies(cookies: string): Promise<{ valid: boolean; userName?: string; error?: string }> {
  try {
    const response = await fetch('https://agent.minimax.io/api/user/info', {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://agent.minimax.io/'
      }
    });

    if (!response.ok) {
      return {
        valid: false,
        error: `HTTP ${response.status}`
      };
    }

    const data = await response.json() as { data?: { name?: string } };
    
    if (data.data?.name) {
      return {
        valid: true,
        userName: data.data.name
      };
    }

    return {
      valid: false,
      error: 'No user data returned'
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
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
  const checkinResult = await performCheckinViaPage(cookies);
  
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
