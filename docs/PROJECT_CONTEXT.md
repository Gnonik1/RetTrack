# RetTrack Project Context

## 1. App Overview

RetTrack is an iOS purchase tracking and return reminder app built with Expo, React Native, TypeScript, and Expo Router.

The app helps users keep track of recent purchases, understand which items are still returnable, and avoid missing return dates. The MVP should stay focused on manually entered purchase records, manually entered return dates, and simple reminder-driven return decisions.

## 2. Core User Flow

1. User adds a purchased item.
2. User enters the basic purchase details, such as item name, store, optional purchase date, price, and return date.
3. User manually chooses the return date. RetTrack does not calculate the return date from a policy in the current MVP.
4. User sees active purchases organized around upcoming return dates.
5. User receives or checks reminders before the return date.
6. If the return date passes and the user has not made a decision, the item moves to Pending Decision.
7. User marks the item as returned or kept.

Return policy support and automatic return date calculation may be added later, but they are not part of the current MVP.

## 3. MVP Item States

- Active: The return date is still upcoming.
- Pending Decision: The return date has passed, but the user has not marked the item as returned or kept.
- Returned: The user returned the item.
- Kept: The user decided to keep the item.

Expired is not a main MVP state for now. The current UX rule is that when the return date passes, the item moves into Pending Decision and the app asks the user what happened.

These states describe product behavior only. The exact data model and UI treatment should be decided later before implementation.

## 4. Planned Screens

- Welcome
- Sign in
- Sign up
- Notification permission
- Add first purchase
- Home / Active purchases
- Item details
- Pending Decision
- Decision date picker
- Returned
- Kept
- History
- Profile
- Settings

No real screens beyond the temporary RetTrack screen have been implemented yet.

## 5. Visual Direction

RetTrack should feel like a premium, clean, calm iOS utility app. The visual direction should be warm, readable, practical, and quietly polished rather than decorative.

Guidelines:

- Light mode first.
- Warm off-white app background.
- White cards for grouped content.
- Swamp green / sage accents for brand color, primary actions, and calm status emphasis.
- Rounded cards with soft borders.
- Simple typography with strong readability.
- Native iOS-style spacing, typography, and simple controls.
- Clear urgency states without overwhelming color.
- Purchase and return date information should be easy to scan quickly.
- Avoid marketing-style layouts inside the app experience.
- Do not add NativeWind.
- Use React Native styling patterns unless a future decision explicitly changes that direction.

Spacing and typography principles:

- Do not adjust font sizes randomly per screen.
- Use semantic typography roles from `theme.ts` for similar text types.
- Similar screen titles such as Sign in and Create account should use the same typography.
- Spacing should be consistent by content type, not copied blindly from the prototype.
- Welcome/onboarding hero screens can be more spacious and brand-focused.
- Auth form screens should be compact enough to be practical, but still calm and premium.
- Add/edit purchase forms should prioritize clarity, readable fields, and predictable vertical rhythm.
- Lists and cards should be scan-friendly with consistent gaps.
- Details/Profile/Settings screens should use grouped iOS-style spacing.
- If a spacing or typography exception is needed, explain why before making it.

## 6. Tech Stack

- Expo
- React Native
- TypeScript
- Expo Router
- npm scripts for Expo commands

Current installed runtime dependencies include Expo, Expo Router, React, React Native, Expo Constants, Expo Linking, Expo Status Bar, React Native Safe Area Context, and React Native Screens.

Current development dependencies include TypeScript and React type definitions.

## 7. Development Rules

- Work step by step.
- Read the existing project before changing it.
- Do not change architecture or direction without approval.
- Do not add NativeWind.
- Do not add unnecessary dependencies.
- Do not install anything unless explicitly requested.
- Do not implement real screens until requested.
- Keep app code changes separate from documentation or planning changes.
- Explain what changed after each step.
- Preserve Expo Router as the owner of app startup.

## 8. Current Project Status

- Clean Expo TypeScript project is created.
- Expo Router is installed.
- `package.json` has `"main": "expo-router/entry"`.
- `app/_layout.tsx` exists and currently renders a basic Expo Router `Stack`.
- `app/index.tsx` exists and currently shows a temporary centered `RetTrack` screen.
- `App.tsx` and `index.ts` are not present because Expo Router owns startup.
- `babel.config.js` is not present.
- `babel-preset-expo` is not installed.
- Expo Go has successfully shown the temporary RetTrack screen.
- No real product screens have been implemented yet.
- No app code was changed during Step 5A.
