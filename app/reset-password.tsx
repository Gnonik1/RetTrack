import { useRouter } from 'expo-router';

import { ResetPasswordScreen } from '../src/features/onboarding/screens/ResetPasswordScreen';

export default function ResetPasswordRoute() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/sign-in');
  };

  return <ResetPasswordScreen onBack={handleBack} />;
}
