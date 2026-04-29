import { useRouter } from 'expo-router';

import { ForgotPasswordScreen } from '../src/features/onboarding/screens/ForgotPasswordScreen';

export default function ForgotPasswordRoute() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/sign-in');
  };

  return <ForgotPasswordScreen onBack={handleBack} />;
}
