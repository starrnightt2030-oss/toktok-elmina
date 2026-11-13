#!/usr/bin/env bash
# Runs inside the generated Capacitor project (after `npx cap add android`): app details the generator does not set.
set -euo pipefail
A=android/app
PKG=io/github/starrnightt/toktokelmina
cp "$GITHUB_WORKSPACE/app/MainActivity.java" "$A/src/main/java/$PKG/MainActivity.java"
# version from the workflow run, so every APK installs over the previous one
sed -i -E "s/versionCode [0-9]+/versionCode ${VERSION_CODE}/; s/versionName \"[^\"]*\"/versionName \"${VERSION_NAME}\"/" $A/build.gradle
# full-screen theme, dark background while loading
sed -i 's#<item name="windowNoTitle">true</item>#<item name="windowNoTitle">true</item>\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowBackground">@color/tt_bg</item>#' $A/src/main/res/values/styles.xml
cat > $A/src/main/res/values/tt_colors.xml <<'X'
<?xml version="1.0" encoding="utf-8"?>
<resources><color name="tt_bg">#101B2D</color></resources>
X
# any orientation the game supports
sed -i 's#android:configChanges="#android:screenOrientation="fullSensor" android:configChanges="#' $A/src/main/AndroidManifest.xml
grep -n "screenOrientation" $A/src/main/AndroidManifest.xml || true
grep -n "versionCode\|versionName" $A/build.gradle || true
