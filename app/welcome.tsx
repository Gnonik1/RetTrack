import { useRouter } from 'expo-router';

import { WelcomeScreen } from '../src/features/onboarding/screens/WelcomeScreen';

export default function WelcomeRoute() {
  const router = useRouter();

  return (
    <WelcomeScreen
      onContinueAsGuest={() => router.push('/notifications')}
      onContinueWithEmail={() => router.push('/sign-up')}
      onSignIn={() => router.push('/sign-in')}
    />
  );
}
