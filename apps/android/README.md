# Android store shell

Trusted Web Activity ([Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)). The icon
opens the **deployed** Ribat site fullscreen in Chrome; UI stays `apps/web`.

## Quick commands (repo root)

```bash
pnpm --filter web build
pnpm android:update   # after twa-manifest.json changes
pnpm android:build    # signed APK + AAB (host must be set)
```

Outputs: `app-release-signed.apk` (link sideload), `app-release-bundle.aab` (Play Console).

## Before the first build

1. Set `host` in [`twa-manifest.json`](./twa-manifest.json) (no `https://`).
2. Deploy the site on that host with `SERVE_WEB=true`.
3. Set `TWA_SHA256_CERT_FINGERPRINTS` on the API; confirm `https://<host>/.well-known/assetlinks.json`.

Toolchain: `pnpm dlx @bubblewrap/cli@1.27.0 doctor` (JDK 17 + Android SDK).

## Test on a phone

```bash
adb install -r app-release-signed.apk
```

Or host the APK at an HTTPS URL and open it on the phone. The first sideload asks to allow
installs from that browser once.

| Check | Expected |
| --- | --- |
| Tap the Ribat icon | Green splash, then the app with no address bar |
| Log in | Works as in mobile Chrome on the same site |
| `/teach` online, then airplane mode | Marks queue offline and sync on reconnect |
| `curl https://<host>/.well-known/assetlinks.json` | Lists `app.ribat.android` and your fingerprint(s) |

An address bar means the asset links or fingerprint do not match the installed APK. Fix the
env var, redeploy, and reinstall.

Updates: keep the same package id and keystore, and users install over the old app. For Play,
upload the `.aab` and add the Play App Signing fingerprint to `TWA_SHA256_CERT_FINGERPRINTS`.
