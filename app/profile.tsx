import { useRouter } from 'expo-router';

import { ProfileScreen } from '../src/features/profile/screens/ProfileScreen';

export default function ProfileRoute() {
  const router = useRouter();

  return (
    <ProfileScreen
      onSignIn={() => router.push('/sign-in')}
      onSignUp={() => router.push('/sign-up')}
    />
  );
}
