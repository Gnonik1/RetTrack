import { getQueryParams } from 'expo-auth-session/build/QueryParams';

import { supabase } from '../lib/supabase';

type AuthDeepLinkSessionResult = {
  hasAccessToken: boolean;
  hasCode: boolean;
  hasRefreshToken: boolean;
  isPasswordRecovery: boolean;
  sessionEstablished: boolean;
};

function getPathFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url, 'https://rettrack.local');

    return `${parsedUrl.hostname}${parsedUrl.pathname}`;
  } catch {
    return url.split('?')[0]?.split('#')[0] ?? '';
  }
}

function isResetPasswordPath(url: string) {
  return getPathFromUrl(url).includes('reset-password');
}

export function isAuthCallbackUrl(url: string) {
  return getPathFromUrl(url).includes('auth-callback');
}

export async function createSessionFromUrl(
  url: string,
): Promise<AuthDeepLinkSessionResult> {
  const { params } = getQueryParams(url);
  const code = params.code;
  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  const hasCode = Boolean(code);
  const hasAccessToken = Boolean(accessToken);
  const hasRefreshToken = Boolean(refreshToken);
  const isPasswordRecovery =
    params.type === 'recovery' || isResetPasswordPath(url);

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    return {
      hasAccessToken,
      hasCode,
      hasRefreshToken,
      isPasswordRecovery,
      sessionEstablished: Boolean(data.session && !error),
    };
  }

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return {
      hasAccessToken,
      hasCode,
      hasRefreshToken,
      isPasswordRecovery,
      sessionEstablished: Boolean(data.session && !error),
    };
  }

  return {
    hasAccessToken,
    hasCode,
    hasRefreshToken,
    isPasswordRecovery,
    sessionEstablished: false,
  };
}
