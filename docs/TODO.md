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

## Purchases / Account Capacity QA

- Controlled Stage 3 edge-case QA:
  - Account 18/20 + guest below limit -> guest can add only 2 more purchases.
  - Account 20/20 -> guest add is blocked with the existing limit-full UI.
  - Raw guest/account counters must not be polluted.
  - Delete / Returned / Kept / edit / photo must not reduce historical counts.
  - Do not reset main data casually.
  - Do not create temporary dev QA helper unless absolutely necessary.
  - Do not commit temporary QA tooling.

## Purchases / Photos

- Support up to 3 photos per item for backend account users later.
- Upload/sync local purchase photos to backend storage later.
- Clean up orphaned local photo files after Delete Purchase.
- Review photo permissions and iOS behavior before production release.

## Profile and Settings refinement

Profile should be refined later based on the saved Profile design direction:
- Use avatar or initials.
- Show full name and email.
- Show signed-in/account status.
- Show plan or usage information.
- Keep Rate RetTrack visible and wire it to the App Store rating/review flow later.
- Add tracked / returned / kept stats only when they come from real data.
- Add last activity only when it is backed by real data.
- Do not add fake stats.
- Build signed-in Profile screen/state after real auth exists.
- Raise the signed-in account item limit to 20 items when account state exists.
- Preserve local guest purchases during future guest-to-account migration/sync.

Settings should be refined later without copying the friend's app structure directly.
Use selected inspiration only:
- softer premium background
- grouped cards
- Share app
- Send feedback
- Contact support
- Privacy Policy
- Terms of Use

Avoid duplicating Profile content in Settings:
- do not repeat account limits
- do not repeat the signed-in account card
- do not repeat Rate RetTrack if it remains in Profile

Keep RetTrack's own visual identity:
- warm cream background
- sage / swamp-green accents
- soft premium feel
- do not copy the friend's blue/purple visual language

Additional Settings backlog:
- When auth/backend sync is implemented, update the Settings App info card from guest/local state to signed-in/sync state: Signed in, Purchases sync across devices, Version 1.0.
- Consider storing currency as a separate structured field later instead of embedding it in the price string.
- Post-MVP: Consider full app-wide dark mode after runtime theme support.

## Notifications

- Test local notification scheduling and delivery in a development build or TestFlight because Expo Go has notification limitations.
- Verify grouped Pending digest delivery in a development build or TestFlight.
- Later, move notification timing and toggle controls into Settings -> Notifications.
- Future notification re-prompt after “Not now”:
  - Consider a limited soft reminder prompt after the user taps “Not now”.
  - Example cadence: 3rd, 6th, and 9th eligible app open.
  - Must be scoped per guest/account.
  - Must not show indefinitely or annoy users.
  - If the user manually turns reminders off from Settings, do not aggressively re-prompt.
  - Keep this as a future enhancement; do not implement until core notification behavior is fully stable.
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
