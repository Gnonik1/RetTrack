# RetTrack TODO

## UI / Components

- Consider extracting repeated input field styles into a shared AppTextField component after Sign In and Sign Up screens are implemented.
- Keep button surface contrast consistent across screens: outline buttons should use white/card background with soft border; secondary buttons should use sage background with subtle border.
- Use the same bottom action spacing pattern from Welcome screen across onboarding screens where appropriate.
- Keep screen title typography consistent across similar auth/onboarding screens.
- Add high-quality optional field icons later using a consistent icon approach; avoid emoji-style text icons.
- Evaluate and add a professional icon system later, such as lucide-react-native, only after checking Expo SDK compatibility and dependency requirements.
- Avoid npm --legacy-peer-deps or --force unless explicitly approved after reviewing the dependency conflict.
- Revisit currency symbols later after confirming reliable font/rendering support for GEL/Lari symbol.
- Evaluate adding a blurred backdrop for centered picker/modals, such as currency/date/photo pickers, after reviewing dependency fit such as expo-blur.

## Purchases / Add First Purchase

- Add disabled/enabled Save item behavior.
- Decide post-save destination after first purchase is added, such as Purchases home/list screen.

## Purchases / Photos

- Add real photo picker later for Add photos.
- Enforce max 3 photos per item.
- Review photo permissions and iOS behavior before adding dependencies.

## Auth / Validation

- Decide disabled/enabled button behavior for invalid forms before auth integration.
- Replace frontend-only auth validation success/no-op behavior with real auth integration later.

## Auth / Password Reset

- Later connect password reset to the selected auth provider.
- Decide final resend/disabled state after password reset email is requested.

## App Config / Assets

- Replace default Expo icon and splash assets with final RetTrack assets before production build.
- Confirm final iOS bundle identifier before App Store setup.
