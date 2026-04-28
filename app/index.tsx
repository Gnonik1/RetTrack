import { useRouter } from 'expo-router';

import { WelcomeScreen } from '../src/features/onboarding/screens/WelcomeScreen';

export default function Index() {
  const router = useRouter();

  return (
    <WelcomeScreen
      onContinueAsGuest={() => router.push('/notifications')}
      onContinueWithEmail={() => router.push('/sign-up')}
      onSignIn={() => router.push('/sign-in')}
    />
  );
}
