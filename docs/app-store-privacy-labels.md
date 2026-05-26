# RetTrack App Store Privacy Labels Draft

## Status

- Working draft for App Store Connect entry.
- Based on current RetTrack release behavior.
- Must be re-checked before App Store submission.
- Future monetization/reporting features are not included unless implemented in the release build.

## Top-Level Answers

- App collects data: Yes
- Data used to track you: No
- Data linked to the user: Yes
- Third-party advertising: No
- Developer advertising or marketing: No
- Analytics: No
- Product personalization: No for the current release, unless changed later
- Main purpose: App Functionality

## Selected Data Types

### Contact Info

- Name
  - Collected: Yes
  - Linked to user: Yes
  - Used for tracking: No
  - Purpose: App Functionality
- Email Address
  - Collected: Yes
  - Linked to user: Yes
  - Used for tracking: No
  - Purpose: App Functionality

### User Content

- Photos or Videos
  - Collected: Yes, when users add purchase photos and especially for signed-in sync
  - Linked to user: Yes
  - Used for tracking: No
  - Purpose: App Functionality
- Other User Content
  - Collected: Yes
  - Includes item names, store names, notes, product links, purchase dates, return dates, price/currency, and return/keep decision status
  - Linked to user: Yes
  - Used for tracking: No
  - Purpose: App Functionality

### Purchases

- Purchase History
  - Collected: Yes, conservative selection
  - Reason: RetTrack stores user-entered purchase records/history
  - Linked to user: Yes for signed-in users
  - Used for tracking: No
  - Purpose: App Functionality

### Identifiers

- User ID
  - Collected: Yes
  - Includes Supabase/auth user ID and account-linked sync IDs
  - Linked to user: Yes
  - Used for tracking: No
  - Purpose: App Functionality

### Usage Data

- Product Interaction
  - Collected: Yes, conservative/verify before final submission
  - Reason: account/guest usage counters, reminder/settings state, onboarding state, and sync/status metadata may be treated as app interaction/functional usage data
  - Linked to user: Yes when account-scoped
  - Used for tracking: No
  - Purpose: App Functionality

## Do Not Select Unless Implementation Changes

- Location
- Contacts
- Payment Info
- Credit Info
- Sensitive Info
- Browsing History
- Search History
- Advertising Data
- Crash Data
- Performance Data
- Device ID
- Third-party advertising
- Analytics
- Tracking

## Current Release Notes

- Guest-only local data is generally local until migrated/synced to an account.
- Signed-in data is linked to the Supabase account/user ID.
- Local notifications/reminders are used.
- No push token registration or remote notification delivery was found in the current audit.
- No analytics, ads, attribution, crash-reporting, IAP, RevenueCat, Stripe, or tracking SDKs were found in the current audit.

## Future Monetization/Reporting Watchlist

These are not included in the initial labels unless implemented before submission:

- Paid plan / higher purchase-entry limit
- Subscription or entitlement tracking
- In-app purchase data
- Savings reports or "money saved" insights
- Advanced reporting
- Server-side analytics/reporting
- Marketing or conversion tracking

Before releasing any monetization, subscription, entitlement, reporting, analytics, or savings-insight feature, re-audit App Store Privacy Labels and Privacy Policy.

## Uncertainties to Verify in App Store Connect

- Whether RetTrack's user-entered purchase records should be selected under Purchases > Purchase History, Other User Content, or both. Conservative draft selects Purchase History.
- Whether Product Interaction should remain selected in final entry.
- Whether Supabase/provider logging requires any additional technical data category.
- Whether Google/Apple auth provider configuration collects fields beyond name/email/auth identifier.
- Whether any analytics/crash/ad SDK is added before submission.
- Confirm Privacy Policy remains consistent with the final labels.
