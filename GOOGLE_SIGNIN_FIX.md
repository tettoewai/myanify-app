# Fixing Google Sign-In DEVELOPER_ERROR (Code 10)

The error `{"code":"10","message":"DEVELOPER_ERROR"}` occurs when your app's SHA-1 certificate fingerprint is not registered in Google Cloud Console.

## Step 1: Get Your SHA-1 Fingerprint

### Option A: Using EAS Build (Recommended for Development Builds)

If you built your app with EAS Build:

1. Run: `npx eas credentials`
2. Select **Android** → **development** (or the profile you used)
3. Copy the **SHA-1 fingerprint** shown

### Option B: Get SHA-1 from Installed APK

1. Install the APK on your device
2. Connect device via USB with USB debugging enabled
3. Run this command to get SHA-1:
   ```bash
   adb shell pm dump com.tlab.myanify | grep -A 1 "Signing" | head -2
   ```
   Or use:
   ```bash
   keytool -printcert -jarfile your-app.apk | grep SHA1
   ```

### Option C: Get SHA-1 from Keystore (if you have it)

If you know your keystore location:
```bash
keytool -list -v -keystore path/to/your.keystore -alias your-alias
```

Look for the **SHA1** value (it looks like: `A1:B2:C3:D4:...`)

## Step 2: Add SHA-1 to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the one with client ID `739457800060-...`)
3. Navigate to **APIs & Services** → **Credentials**
4. Find your **Android OAuth 2.0 Client ID** (ending in `...aab7.apps.googleusercontent.com`)
5. Click **Edit**
6. Under **SHA certificate fingerprints**, click **+ ADD SHA CERTIFICATE FINGERPRINT**
7. Paste your SHA-1 fingerprint (format: `XX:XX:XX:...` without spaces)
8. Click **SAVE**

## Step 3: Add SHA-1 to Firebase Console (CRITICAL)

**⚠️ IMPORTANT:** Your `google-services.json` currently has an empty `oauth_client` array, which means SHA-1 fingerprints haven't been registered in Firebase yet.

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **myanify-98ced**
3. Go to **Project Settings** (gear icon) → **Your apps** → Select your Android app (`com.tlab.myanify`)
4. Under **SHA certificate fingerprints**, click **Add fingerprint**
5. Paste your SHA-1 fingerprint (format: `XX:XX:XX:...`)
6. Click **Save**
7. **Download the new `google-services.json`** file (this is crucial!)
8. Replace `myanify-app/google-services.json` with the new file

## Step 4: Verify Configuration

Your current configuration in `app.json`:
- Package name: `com.tlab.myanify` ✅
- Android Client ID: `739457800060-e53a1s0m3576udu1o5id670plh18aab7.apps.googleusercontent.com` ✅
- Web Client ID: `739457800060-eq2ieghufl3vmdr96se7tofi9h67gr6i.apps.googleusercontent.com` ✅

Make sure:
- The package name in Google Cloud Console matches: `com.tlab.myanify`
- The SHA-1 you added matches the keystore used to sign your development build
- The **new** `google-services.json` has populated `oauth_client` array (not empty `[]`)

## Step 5: Rebuild Your App

After adding the SHA-1:
1. Rebuild your development build: `eas build --profile development --platform android`
2. Install the new build on your device
3. Test Google Sign-In again

## Troubleshooting

- **Still getting the error?** 
  - Wait 5-10 minutes after adding SHA-1 (Google caches configurations)
  - Verify your new `google-services.json` has `oauth_client` array with entries (not empty `[]`)
  - Make sure you rebuilt the app after replacing `google-services.json`
  
- **Multiple builds?** You may need multiple SHA-1 fingerprints (debug, release, EAS build)

- **Check google-services.json:** After downloading from Firebase, verify it contains OAuth client configurations. An empty `"oauth_client": []` means SHA-1 wasn't registered properly.

- **Both Google Cloud Console AND Firebase:** 
  - Add SHA-1 to **Firebase Console** (affects `google-services.json`)
  - Add SHA-1 to **Google Cloud Console** → OAuth 2.0 Client ID (for direct OAuth)

- **After updating `google-services.json`:** Always rebuild your app - the native Android code reads this file during build time.
