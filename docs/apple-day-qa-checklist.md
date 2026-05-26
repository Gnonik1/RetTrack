# RetTrack Apple-Day QA Checklist

This checklist is for the first Apple Developer / iOS development build / TestFlight validation pass. It should be used before App Store submission.

## 1. Build and install

- Create iOS development or preview build.
- Install on a real iPhone.
- Confirm app opens without crash.
- Confirm app icon appears correctly on device.
- Confirm native splash -> React startup splash -> app transition works.
- Confirm no white/black flash.
- Confirm app does not get stuck on splash.

## 2. Startup and navigation

- Cold launch to expected startup route.
- Confirm /purchases opens correctly after ready state.
- Confirm Welcome / onboarding flow still works for fresh user state.
- Confirm Home / History / Profile / Settings tabs work.
- Confirm no duplicate bottom nav.
- Confirm no Profile/Settings first-load snap/flicker.
- Confirm Add button opens Add Purchase.
- Confirm back/save flow from Add Purchase works.

## 3. Auth

- Continue as guest works.
- Email sign-up works.
- Email sign-in works.
- Sign-out works.
- Google sign-in works and account chooser behavior is acceptable.
- Apple Sign In works end-to-end.
- Profile sign-in/sign-up links route correctly.
- Account state is correct after restart.

## 4. Password reset / deep links

- Forgot password email sends.
- Reset password link opens the app correctly.
- Reset password screen works.
- After reset, sign-in works.
- No broken route or blank screen after link handoff.

## 5. Purchases core flow

- Add purchase as guest.
- Add purchase as signed-in user.
- Edit purchase.
- Delete purchase.
- Mark Returned.
- Mark Kept.
- Pending Decision behavior works after return date passes.
- Purchase details opens.
- Edit from details works.
- History shows Returned/Kept correctly.

## 6. Account limits / quota

- Signed-in usage count displays correctly.
- Guest effective remaining displays correctly after signed-in snapshot.
- 18/20 -> guest has 2 remaining behavior still works if test data is available.
- 20/20 -> guest add is blocked behavior still works if test data is available.
- Delete / Returned / Kept does not reduce historical usage.

## 7. Photos

- Add local photo to purchase.
- Edit photo list.
- Remove photo.
- Delete purchase with copied photo.
- Confirm copied local photo cleanup still works.
- Signed-in photo upload/sync works.
- Remote photo displays after restart.
- Guest/account photo behavior remains safe.
- Account deletion/photo cleanup smoke test if disposable account is available.

## 8. Notifications

- iOS notification permission prompt works.
- Not now / allowed behavior is correct.
- Reminders enabled/disabled preference behaves correctly.
- Scheduled reminders do not duplicate after restart.
- 7-day return reminders are grouped.
- 3-day return reminders are grouped.
- Pending review digest still works.
- Due today / last-day grouped behavior still works.
- Turning reminders off cancels scheduled reminders.

## 9. Account deletion

- Delete account flow works with disposable account.
- Backend delete succeeds.
- App signs out locally.
- Account-scoped local cleanup runs.
- Local reminders are canceled.
- Deleted account cannot be reused incorrectly.
- Backend failure path does not clear local state.

## 10. Legal and App Store links

- Privacy Policy link opens.
- Terms of Use link opens.
- Support/contact information is correct.
- App Store metadata matches approved final copy.
- App Store screenshots are uploaded in approved order.
- App Store privacy labels match docs/app-store-privacy-labels.md.

## 11. Final App Store Connect checks

- App name: RetTrack.
- Subtitle: Purchase & return tracker.
- Promotional text is entered exactly as approved.
- Keywords are entered exactly as approved.
- Description is entered exactly as approved.
- Review notes are entered exactly as approved.
- Privacy Policy URL is correct.
- Terms URL is available where needed.
- Category is Productivity, with Lifestyle as secondary if used.
- No paid subscription/IAP is required for review in the current release.

## 12. Regression smoke

- App launches after reinstall.
- App launches after force close.
- App launches after sign-out/sign-in.
- No obvious layout flicker on main tabs.
- No broken navigation stack.
- No console/runtime errors visible during core flows.

## Release blockers if failed

- App crash on launch
- Broken auth
- Broken Apple Sign In
- Broken account deletion
- Broken password reset deep link
- Broken purchase add/edit/delete
- Broken notification permission or scheduling
- Broken legal/privacy URLs
- App Store metadata/privacy mismatch
- Native splash/app icon visibly wrong
