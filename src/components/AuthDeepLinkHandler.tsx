import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import {
  createSessionFromUrl,
  isAuthCallbackUrl,
} from '../services/authDeepLinkService';

export function AuthDeepLinkHandler() {
  const router = useRouter();
  const handledUrlsRef = useRef(new Set<string>());

  useEffect(() => {
    let isMounted = true;

    const handleUrl = async (url: string | null) => {
      if (!url || handledUrlsRef.current.has(url) || isAuthCallbackUrl(url)) {
        return;
      }

      handledUrlsRef.current.add(url);

      const result = await createSessionFromUrl(url);

      if (
        isMounted &&
        result.isPasswordRecovery &&
        result.sessionEstablished
      ) {
        router.replace('/reset-password');
      }
    };

    Linking.getInitialURL().then(handleUrl).catch(() => undefined);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [router]);

  return null;
}
