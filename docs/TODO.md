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

- Add Add First Purchase form state and validation.
- Required fields should include item name and return date.
- Require either store or product link before saving.
- Add disabled/enabled Save item behavior.
- Add local mock saved-item flow before backend persistence.

## Purchases / Photos

- Add real photo picker later for Add photos.
- Enforce max 3 photos per item.
- Review photo permissions and iOS behavior before adding dependencies.

## Auth / Validation

- Add Sign In validation: required email, valid email format, required password, and login error state.
- Add Sign Up validation: required full name, valid email format, required password, and password minimum 8 characters.
- Add inline error states for input fields using the app error/pending color.
- Decide disabled/enabled button behavior for invalid forms before auth integration.

## Auth / Password Reset

- Add Forgot Password screen.
- Flow: user enters email, taps Send reset link, then sees a neutral confirmation message.
- Confirmation copy: “If an account exists for that email, we’ll send password reset instructions.”
- Later connect password reset to the selected auth provider.

## App Config / Assets

- Replace default Expo icon and splash assets with final RetTrack assets before production build.
- Confirm final iOS bundle identifier before App Store setup.
