# RetTrack TODO

## UI / Components

- Keep button surface contrast consistent across screens: outline buttons should use white/card background with soft border; secondary buttons should use sage background with subtle border.
- Use the same bottom action spacing pattern from Welcome screen across onboarding screens where appropriate.
- Keep screen title typography consistent across similar auth/onboarding screens.
- Add high-quality optional field icons later using a consistent icon approach; avoid emoji-style text icons.
- Optional later icon-system review should focus on non-bottom-nav icons, such as notification and purchase item icons, only after checking Expo SDK compatibility and dependency requirements.
- Avoid npm --legacy-peer-deps or --force unless explicitly approved after reviewing the dependency conflict.
- Revisit currency symbols later after confirming reliable font/rendering support for GEL/Lari symbol.
- Evaluate adding a blurred backdrop for centered picker/modals, such as currency/date/photo pickers, after reviewing dependency fit such as expo-blur.

## Bottom Navigation / Main Tabs

- Bottom navigation polish completed locally:
  - Custom `AppBottomNav` SVG icon set is the final local baseline for approved App Store screenshots.
  - Active tab uses the approved soft sage capsule visual state.
  - Home / History / Profile / Settings icon balance is completed locally, including final Home tab optical balance refinement.
  - Add remains the main green circular action.
- Persistent main-tabs/navigation flicker fix completed locally:
  - Home / History / Profile / Settings now use a persistent Expo Router tabs layout.
  - Tab switching is stable, with no duplicate bottom navigation.
  - First-load Profile / Settings layout snap is fixed locally.
  - Add still pushes `/add-purchase`; purchase details and edit routes remain outside the main tabs.
- Release QA reminder:
  - Re-test bottom nav visuals, tab switching, no duplicate nav, Add flow, details/edit routes, and Profile/Settings first-load stability in an iOS development build/TestFlight before App Store submission.

## Purchases / Add First Purchase

- Add disabled/enabled Save item behavior.

## Purchases / Account Capacity QA

- Stage 3 guest/account capacity boundary QA completed locally:
  - Account 18/20 correctly limits guest remaining capacity to 2.
  - Guest can add exactly two purchases.
  - Third guest add is blocked with the existing limit-full UI.
  - Guest-origin purchases are counted toward account historical usage after migration.
  - Account reaches 20/20 after migrated guest-origin purchases are counted.
  - Guest shows 0 remaining after sign-out from a 20/20 account.
  - Guest add is blocked at 20/20.
- Release QA reminder:
  - Re-test Stage 3 capacity behavior in an iOS development build/TestFlight before public App Store submission.

## Purchases / Photos

- Signed-in photo upload/sync and photo UI support are implemented:
  - Guest and signed-in Free users can add 1 photo per item.
  - Existing 2-3 photo items remain visible for legacy/current synced data.
  - Signed-in local purchase photos sync to backend storage and metadata.
  - Remote hydration cap is intentionally separate from `PRO_PHOTO_LIMIT`. If the Pro photo limit changes in the future, keep legacy/sync cap decisions explicit via `LEGACY_REMOTE_PHOTO_CAP` or a renamed successor constant.
  - Open risk: `purchasePhotoSyncService` replacement sync is non-atomic. Current flow may involve upload/delete/update steps and should be reviewed separately before broader photo sync changes.
- Local copied photo cleanup completed:
  - Purchase delete/edit flows now delete unreferenced app-owned copied local photo files after purchase persistence succeeds.
  - Cleanup is best-effort and does not block purchase delete/edit.
  - Remote URLs, content URIs, external library URIs, and unrelated local files are ignored.
  - Copied files still referenced by another purchase are preserved.
- Re-test purchase photo behavior in an iOS development build/TestFlight before public App Store submission:
  - Re-test purchase delete/edit copied photo cleanup.
  - Re-test signed-in photo upload/sync after photo cleanup changes.
  - Re-test Free 1-photo add/block behavior plus legacy 2-3 photo replace, remove, reorder, and display behavior.
  - Review photo permissions and iOS behavior before production release.

## Profile and Settings refinement

Profile should be refined later based on the saved Profile design direction:
- Use avatar or initials.
- Show full name and email.
- Show signed-in/account status.
- Show plan or usage information.
- Keep Rate RetTrack visible; verify the App Store rating/review flow after release.
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

## Post-Launch Polish / Follow-Up

These are not launch blockers for build 1.0.0 (9).

- Verify Rate App after RetTrack is live on the App Store:
  - Confirm the App Store write-review URL opens correctly.
  - Keep the fallback alert for pre-release or unavailable cases if appropriate.
- Verify Share App after RetTrack is live on the App Store:
  - Confirm the App Store URL opens correctly.
  - Keep the current polished share message unless better final marketing copy is approved.
- Improve Apple Sign In transition polish:
  - Current behavior works, but Apple sign-in can briefly show a white or blank transition for about 1-2 seconds.
  - Later replace this with a calm loading state if needed.
- Revisit iPad support after the first release:
  - First release is iPhone-only.
  - Add real iPad support only when there is a proper iPad layout and iPad App Store screenshots.
- Consider adding or refining Contact Support / Send Feedback rows if useful for post-launch support.

## Notifications

- Test local notification scheduling and delivery in a development build or TestFlight because Expo Go has notification limitations.
- Verify grouped Pending digest delivery in a development build or TestFlight.
- Real iOS notification delivery QA:
  - Deferred until Apple Developer Program / dev build or TestFlight setup is available.
  - Expo Go is enough for current notification UI/preference QA, but not enough to fully prove real iOS notification delivery.
  - Later, test in an iOS development build or TestFlight:
    - return reminder delivery
    - grouped return reminder delivery
    - grouped pending digest delivery
    - Settings/Home reminder toggle scheduling and cancellation
    - app restart/sign-in/guest scoped reminder behavior
  - Apple/TestFlight notification QA remains blocked until Apple Developer account / dev build or TestFlight setup is available.
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

- Auth integration is implemented; keep disabled/enabled invalid-form behavior as a polish decision:
  - Decide whether invalid auth/purchase forms should keep current submit-then-show-errors behavior or switch to disabled/enabled buttons.

## Auth / Password Reset

- Verify password reset email link handoff in a development build/TestFlight:
  - Confirm valid reset links open RetTrack and allow password update.
  - Confirm expired/used/direct `/reset-password` opens show the invalid-link recovery state.
- Review Supabase Auth reset email sender, subject, and template so it feels like RetTrack.
- Review auth email/provider branding and visible provider/Supabase links.
- Keep auth email/provider branding as launch-readiness polish, not a current local-development blocker.

## Auth / Provider QA

- Google account chooser fix completed; verify Google native return-to-app/session handoff in an iOS development build/TestFlight.
- Apple Sign In setup/QA remains blocked until Apple Developer account is available:
  - Configure required Apple/Supabase provider settings when the account is available.
  - Verify native Apple Sign In success, cancel, and provider-setup-required states in an iOS development build/TestFlight.

## Auth / Account Deletion

- Account deletion deployment and initial live QA completed:
  - Supabase Edge Function `delete-account` is deployed.
  - Disposable account deletion was tested successfully.
  - Backend deletion verification passed: auth user, profile row, purchases, purchase_photos rows, and storage objects were deleted as expected.
- Account deletion local cleanup completed:
  - After backend success, account deletion deletes account-only app-owned copied local purchase photo files.
  - Copied files still referenced by guest scope are preserved.
  - Scheduled RetTrack reminders are cancelled before local sign-out.
  - Account-scoped local state is then cleared and the local Supabase session is signed out.
  - Cleanup is best-effort and does not undo successful backend deletion if local photo/reminder cleanup fails.
- Repeat account deletion smoke QA in an iOS development build/TestFlight before public App Store submission:
  - Test only with a disposable or controlled account, not the main account.
  - Re-test account deletion local cleanup after success.
  - Verify local account-scoped storage/session cleanup after success.
  - Verify account-only copied local purchase photo files are deleted after success.
  - Verify scheduled RetTrack reminders are cancelled after success.
  - Verify partial failure shows a retryable error and does not falsely claim success.
  - Confirm guest mode still shows deletion unavailable.
  - Keep server-side service-role secrets out of Expo/client code, EAS public env, app config, and repo files.
  - Confirm Privacy Policy/App Store disclosures accurately cover in-app account and related account-data deletion.

## App Store / Launch Readiness

- Completed launch-readiness implementation/config cleanup:
  - Final RetTrack app icon asset has replaced the default Expo icon.
  - Final RetTrack splash icon asset has replaced the default Expo splash asset.
  - Production splash setup is completed locally and committed:
    - expo-splash-screen is installed.
    - Native splash config is added in app.json.
    - React startup splash is added.
    - React startup splash visual is approved locally.
    - No further splash visual polish is planned for now.
  - Production startup routing has been restored.
  - Supabase CLI project config is committed.
  - Supabase live verification passed.
  - Google account chooser fix is committed.
  - Account deletion deployment, live backend QA, and local cleanup are completed.
  - Purchase delete/edit copied local photo cleanup is completed.
  - Signed-in photo upload/sync support and plan-ready photo limits are implemented.
- App Store presentation completed locally:
  - App Store screenshots are approved.
  - Approved screenshot set/order:
    1. Track what you buy — All your purchases in one calm place
    2. Return on time — See what’s due soon before it costs you
    3. Save the details that matter — Price, dates, links, photos, and notes — all in one place
    4. Return it or keep it — Mark your decision in one tap and keep your history clear
    5. Your purchases stay with you — Sign in to sync across devices
  - App Store metadata is approved:
    - App Name: RetTrack
    - Subtitle: Purchase & return tracker
    - Promotional Text: Track what you buy, remember return windows, and keep the details that matter in one calm place.
    - Keywords: reminder,shopping,items,organizer,receipt,deadline,dates,online,orders,store,history,notes
    - Primary Category: Productivity
    - Secondary Category if needed: Lifestyle
  - App Store description is approved.
  - App Store review notes are approved.
  - Privacy Policy and Terms URLs are available.
  - App Store Privacy Labels draft is prepared in `docs/app-store-privacy-labels.md`.
  - Apple-day QA checklist is prepared in `docs/apple-day-qa-checklist.md`.
  - Bottom navigation visual baseline is final for App Store screenshots.
  - Notification grouping fix is completed and committed.
- App Store / launch tasks still pending:
  - Complete Apple Developer account setup.
  - Complete App Store Connect setup.
  - Enter final App Store privacy labels.
  - Upload final screenshots and metadata to App Store Connect.
  - Confirm final app icon readiness in an iOS development build/TestFlight.
  - Confirm final iOS bundle identifier before App Store setup.
  - Complete iOS development build/TestFlight QA.
  - Complete native Apple Sign In QA after Apple Developer account is available.
  - Complete password reset native deep-link QA.
  - Complete real iOS notification delivery/grouping QA.
  - Repeat account deletion smoke QA in an iOS development build/TestFlight.
  - Re-test purchase photo sync and photo cleanup in an iOS development build/TestFlight.
  - Re-audit App Store Privacy Labels and Privacy Policy before releasing monetization, subscription, entitlement, reporting, analytics, or savings-insight features.
- Release QA still pending:
  - Verify native splash -> React startup splash -> app transition in an iOS development/preview/TestFlight build:
    - Confirm no white/black flash.
    - Confirm the app does not get stuck on splash.
    - Confirm startup routing still works.
  - Re-test Stage 3 capacity behavior in iOS development build/TestFlight.
  - Complete real iOS notification delivery/toggle/grouping/digest QA.
  - Complete password reset native deep-link QA.
  - Complete Google native return-to-app QA.
  - Complete Apple Sign In setup/QA after Apple Developer account is available.
  - Repeat account deletion smoke QA in an iOS development build/TestFlight.
  - Re-test purchase photo cleanup and signed-in photo sync in an iOS development build/TestFlight.
