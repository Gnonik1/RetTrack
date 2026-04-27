# RetTrack TODO

## UI / Components

- Consider extracting repeated input field styles into a shared AppTextField component after Sign In and Sign Up screens are implemented.
- Keep button surface contrast consistent across screens: outline buttons should use white/card background with soft border; secondary buttons should use sage background with subtle border.
- Use the same bottom action spacing pattern from Welcome screen across onboarding screens where appropriate.
- Keep screen title typography consistent across similar auth/onboarding screens.
- Remember that app/index.tsx is temporarily used for screen preview until navigation is implemented.

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
