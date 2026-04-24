# Trackr

Personal finance app built with [Expo](https://expo.dev) (SDK 54), [Expo Router](https://docs.expo.dev/router/introduction/), React Native, and TypeScript. Local data uses **expo-sqlite**; profiles and theme preferences use AsyncStorage.

## Features

- **Onboarding** — display name and primary **currency** (used across formatting and exports)
- **Dashboard** — month summary, spend vs last month, category breakdown, budgets for the month, recent transactions
- **History** — browse and explore past activity
- **Analytics** — insights and **spending trend** chart (week / month views)
- **Transactions** — add income and expenses with categories, notes, and payment method
- **Budgets** — monthly budgets per category or area
- **Categories** — custom expense/income categories
- **Settings** — light / dark / system theme, edit profile, **export CSV & JSON**, import JSON backup, clear all data
- **Offline-first** — SQLite on device; no account required for core use

## Requirements

- **Node.js** 20+ (LTS recommended)
- **npm**
- For **local Android builds**: **JDK 17+** (Android Gradle Plugin does not support Java 11)
- For **EAS**: an [Expo](https://expo.dev) account and, for CI, an **`EXPO_TOKEN`**

## Install and run (development)

```bash
npm install
npx expo start
```

Then open in Expo Go, or press `i` / `a` for simulator/emulator (see [Expo workflow](https://docs.expo.dev/get-started/set-up-your-environment/)).

```bash
npm run android   # expo start --android
npm run ios       # expo start --ios
npm run web       # expo start --web
npm run lint      # expo lint
```

## Native projects and prebuild

This repo **does not commit** `android/` or `ios/` (they are gitignored). EAS Build runs **prebuild** on the server. To generate native folders locally (debugging native config, running `expo run:android`, or opening Android Studio):

### Generate native directories

```bash
# Android only
npx expo prebuild --platform android

# iOS only (macOS)
npx expo prebuild --platform ios

# Both
npx expo prebuild
```

### Clean regeneration

If native projects exist and you changed plugins, icons, or `app.json` native settings:

```bash
npx expo prebuild --clean
```

After prebuild, Gradle reads **`reactNativeArchitectures`** from `gradle.properties` (set by **`expo-build-properties`** from [`app.json`](app.json)):

- **`armeabi-v7a`** — 32-bit ARM devices  
- **`arm64-v8a`** — 64-bit ARM devices (most current phones)

**Not included:** `x86` / `x86_64` (typical Intel Android emulators). Release-style binaries are aimed at **real devices** (or **arm64** emulators on Apple Silicon).

To change ABIs, edit the `expo-build-properties` → `android.buildArchs` entry in [`app.json`](app.json). Example for smallest APK (64-bit only): `["arm64-v8a"]` — drops older 32-bit-only phones.

## Builds (EAS)

Configuration lives in [`eas.json`](eas.json).

| Profile       | Android output | Typical use        |
|---------------|----------------|-------------------|
| **`preview`** | **APK**        | Internal / sideload |
| **`production`** | **AAB** (app bundle) | Google Play     |

### Cloud build (recommended)

```bash
npx eas login
npx eas build:configure   # first time, links project
npx eas build --platform android --profile preview
```

Use `--profile production` for a Play Store bundle.

### Local Android APK (your machine)

Requires Docker (EAS local Android flow), Android toolchain, and **JDK 17+**. On macOS the helper script prefers a JDK 17+ from `/usr/libexec/java_home`:

```bash
npm run build:android:apk:local
# → runs scripts/eas-build-android-local.sh → eas build --platform android --profile preview --local
```

Install JDK 17 if needed, e.g. `brew install temurin@17`.

## GitHub Actions → Releases

Pushing a tag `v*` runs [`.github/workflows/release-android.yml`](.github/workflows/release-android.yml): EAS cloud build (`preview` APK), then uploads the artifact to a **GitHub Release**.

Add repository secret **`EXPO_TOKEN`** (Expo → Access tokens).

## Privacy policy hosting (GitHub Pages)

For Play Console, a static privacy policy page is available at `docs/index.html`.

To host it with GitHub Pages, set:

- Source: **Deploy from a branch**
- Branch: `main`
- Folder: `/docs`

Then use the published Pages URL in Play Console.

## Project layout (short)

| Path | Role |
|------|------|
| `app/` | Expo Router screens |
| `components/` | UI components |
| `contexts/` | React context (theme, DB, user profile) |
| `db/` | SQLite open + migrations |
| `lib/` | Helpers (export, formatting, etc.) |
| `plugins/` | Expo config plugins |
| `assets/images/` | App icon, adaptive foreground, splash, favicon |

## License

Private project unless noted otherwise.
