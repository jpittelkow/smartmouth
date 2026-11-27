# Smartmouth TV app (Android TV)

A thin native shell around the game's TV screen. The screen itself is a web page served by the
Smartmouth Node server at `<server>/host`; this app is a full-screen WebView pointed at
`<server>/host?tv=1`, plus what a web page cannot do on its own:

- full-screen immersive, screen kept awake while running
- the host voice autoplays (`mediaPlaybackRequiresUserGesture = false`)
- remote D-pad / OK reach the page as ordinary key events (arrow keys, Enter)
- **Back** goes to the page first: the app calls `window.smartmouthBack()`; if it returns `true`
  the press is consumed. Otherwise a second Back within 2 s quits the app.
- a native retry screen with exponential-backoff reconnect (2 s, 4 s, 8 s … capped at 60 s) when
  the server cannot be reached, instead of a browser error page
- a JS bridge, `window.SmartmouthTV`, with `isTv()` (true on Android TV / Google TV) and
  `appVersion()`
- the page may only navigate within the configured server (same scheme, host and port)

Players join on their phones in the browser; nothing about that is in this app.

Package `app.smartmouth.tv`, minSdk 26 (Android 8), targetSdk 34. The app name lives in one place,
`app/src/main/res/values/strings.xml` (`app_name`). The TV banner (`res/drawable/banner.xml`) draws
the word as vector strokes, so redraw it if the app is renamed.

## Build

Needs JDK 17+ and the Android SDK (`local.properties` with `sdk.dir=...`, git-ignored; Android Studio
writes it, or create it by hand).

```sh
./gradlew assembleDebug          # Git Bash / macOS / Linux
gradlew.bat assembleDebug        # Windows cmd / PowerShell
```

Output: `app/build/outputs/apk/debug/app-debug.apk`. Unit tests: `./gradlew testDebugUnitTest`.

On Jeff's PC under Claude Code's sandbox, Gradle fails with `Unable to establish loopback connection`.
Run it with:

```sh
JAVA_TOOL_OPTIONS='-Djdk.net.unixdomain.tmpdir=C:\tmp\gradle-sock' TEMP='C:\tmp' TMP='C:\tmp' ./gradlew.bat assembleDebug
```

## Server address

The default is baked in at build time from the Gradle property `smartmouthServerUrl`
(default `http://10.0.2.2:8470`, which is the dev PC as seen from the Android emulator):

```sh
./gradlew assembleDebug -PsmartmouthServerUrl=http://192.168.1.4:8470
```

(or put `smartmouthServerUrl=...` in `~/.gradle/gradle.properties`). It ends up in
`BuildConfig.DEFAULT_SERVER_URL`.

At run time, per device (saved in SharedPreferences and kept across updates):

- **From ADB** (no remote needed):

  ```sh
  adb shell am start -n app.smartmouth.tv/.ConfigActivity --es server_url http://192.168.1.4:8470
  ```

  This saves the address and opens the game. Only ADB's shell can start this screen from outside
  the app (the manifest requires `android.permission.DUMP`), so other apps on the TV cannot repoint
  it. Bad addresses (not `http(s)://host...`) are refused and logged under the `SmartmouthTV` tag.

- **With the remote**: when the server cannot be reached the retry screen appears; hold **OK** on
  *Retry now*, hold **Menu**, or choose *Server settings*. Enter the base address (no `/host`),
  then *Save*. *Use default* goes back to the build-time address.

## Install

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n app.smartmouth.tv/.MainActivity
```

For a TV on the network: `adb connect <tv-ip>:5555` first (enable network/wireless debugging on the
TV). If the server runs on your PC, `adb reverse tcp:8470 tcp:8470` lets the TV reach it at
`http://127.0.0.1:8470` with no firewall change.

The app shows up in the Android TV launcher (leanback banner) and also in a phone/emulator's app
drawer (normal launcher entry), so it can be tried on a phone emulator.

## Debugging

Debug builds enable WebView remote debugging: open `chrome://inspect` on the PC with the device
connected over ADB. Page `console.*` output is also mirrored to logcat:
`adb logcat -s SmartmouthTV`.
