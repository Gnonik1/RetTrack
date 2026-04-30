import { Redirect } from 'expo-router';

export default function Index() {
  // Temporary development shortcut for Purchases Home UI testing.
  // Restore the WelcomeScreen root flow before final onboarding testing/production.
  return <Redirect href="/purchases" />;
}
