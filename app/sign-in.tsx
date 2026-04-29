import { useRouter } from 'expo-router';

import { SignInScreen } from '../src/features/onboarding/screens/SignInScreen';

export default function SignInRoute() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  return (
    <SignInScreen
      onBack={handleBack}
      onForgotPassword={() => router.push('/forgot-password')}
    />
  );
}
