# RetTrack TODO

## UI / Components

- Keep button surface contrast consistent across screens: outline buttons should use white/card background with soft border; secondary buttons should use sage background with subtle border.
- Use the same bottom action spacing pattern from Welcome screen across onboarding screens where appropriate.
- Keep screen title typography consistent across similar auth/onboarding screens.
- Add high-quality optional field icons later using a consistent icon approach; avoid emoji-style text icons.
- Replace temporary custom-drawn icons with a professional icon system later, such as lucide-react-native, only after checking Expo SDK compatibility and dependency requirements; include Home, History, Profile, Settings, notification, and purchase item icons in that review.
- Avoid npm --legacy-peer-deps or --force unless explicitly approved after reviewing the dependency conflict.
- Revisit currency symbols later after confirming reliable font/rendering support for GEL/Lari symbol.
- Evaluate adding a blurred backdrop for centered picker/modals, such as currency/date/photo pickers, after reviewing dependency fit such as expo-blur.

## Purchases / Add First Purchase

- Add disabled/enabled Save item behavior.

## Purchases / Photos

- Support up to 3 photos per item for backend account users later.
- Upload/sync local purchase photos to backend storage later.
- Clean up orphaned local photo files after Delete Purchase.
- Review photo permissions and iOS behavior before production release.

## Profile / Guest Mode

- Build signed-in Profile screen/state after real auth exists.
- Raise the signed-in account item limit to 20 items when account state exists.
- Preserve local guest purchases during future guest-to-account migration/sync.
- Wire Rate RetTrack to the App Store rating/review flow later.

## Settings

- When auth/backend sync is implemented, update the Settings App info card from guest/local state to signed-in/sync state: Signed in, Purchases sync across devices, Version 1.0.
- Consider storing currency as a separate structured field later instead of embedding it in the price string.
- Post-MVP: Consider full app-wide dark mode after runtime theme support.

## Notifications

- Test local notification scheduling and delivery in a development build or TestFlight because Expo Go has notification limitations.
- Verify grouped Pending digest delivery in a development build or TestFlight.
- Later, move notification timing and toggle controls into Settings -> Notifications.
- Later, let the Home bell become an insights or updates entry point after real monthly reports or savings analytics exist.
- Do not build a placeholder Updates screen until there is real content to show.
- Delivered notification history needs an app-owned notification log if added.

## Auth / Validation

- Decide disabled/enabled button behavior for invalid forms before auth integration.
- Replace frontend-only auth validation success/no-op behavior with real auth integration later.

## Auth / Password Reset

- Later connect password reset to the selected auth provider.
- Decide final resend/disabled state after password reset email is requested.

## App Config / Assets

- Replace default Expo icon and splash assets with final RetTrack assets before production build.
- Confirm final iOS bundle identifier before App Store setup.
