const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin that configures the app for Android TV / Leanback.
 *
 * - Declares android.software.leanback feature (required=false allows both TV and mobile)
 * - Declares android.hardware.touchscreen as NOT required (TV has no touchscreen)
 * - Adds LEANBACK_LAUNCHER intent-filter to main activity
 * - Sets the app as a TV app with banner icon
 */
module.exports = function withAndroidTV(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const mainApplication = manifest.application[0];

    // 1. Add android:banner to application (TV Banner - 320x180px)
    mainApplication.$['android:banner'] = '@mipmap/ic_launcher';

    // 2. Add uses-feature for Leanback (TV support)
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    // Add leanback feature
    const hasLeanback = manifest['uses-feature'].some(
      (f) => f.$?.['android:name'] === 'android.software.leanback'
    );
    if (!hasLeanback) {
      manifest['uses-feature'].push({
        $: {
          'android:name': 'android.software.leanback',
          'android:required': 'true',
        },
      });
    }

    // Declare touchscreen as NOT required (TV doesn't have touchscreen)
    const hasTouchscreen = manifest['uses-feature'].some(
      (f) => f.$?.['android:name'] === 'android.hardware.touchscreen'
    );
    if (!hasTouchscreen) {
      manifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.touchscreen',
          'android:required': 'false',
        },
      });
    }

    // 3. Add LEANBACK_LAUNCHER intent-filter to main activity
    const mainActivity = mainApplication.activity?.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      // Check if LEANBACK_LAUNCHER filter already exists
      const hasLeanbackLauncher = mainActivity['intent-filter'].some(
        (filter) =>
          filter.category?.some(
            (cat) => cat.$?.['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER'
          )
      );

      if (!hasLeanbackLauncher) {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } },
          ],
        });
      }

      // Set screen orientation to landscape
      mainActivity.$['android:screenOrientation'] = 'landscape';
    }

    return config;
  });
};
