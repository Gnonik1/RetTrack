import { useRouter } from 'expo-router';

import { SignUpScreen } from '../src/features/onboarding/screens/SignUpScreen';

export default function SignUpRoute() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  return (
    <SignUpScreen
      onBack={handleBack}
      onCreateAccount={() => router.push('/notifications')}
    />
  );
}
