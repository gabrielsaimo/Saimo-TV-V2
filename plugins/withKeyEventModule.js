const { withMainActivity } = require('@expo/config-plugins');

/**
 * Expo config plugin that adds onKeyDown/onKeyUp overrides to MainActivity.
 * Required for react-native-keyevent to dispatch D-pad events to JavaScript.
 *
 * Without this, DeviceEventEmitter never fires 'onKeyUp'/'onKeyDown',
 * so useTVKeyHandler receives no events and channel switching doesn't work.
 */
module.exports = function withKeyEventModule(config) {
  return withMainActivity(config, (config) => {
    const mainActivity = config.modResults;

    // Add import for KeyEventModule
    if (!mainActivity.contents.includes('import com.github.kevinejohn.keyevent.KeyEventModule')) {
      mainActivity.contents = mainActivity.contents.replace(
        /^(package .+\n)/m,
        '$1\nimport com.github.kevinejohn.keyevent.KeyEventModule\n'
      );
    }

    // Add import for Android KeyEvent
    if (!mainActivity.contents.includes('import android.view.KeyEvent')) {
      mainActivity.contents = mainActivity.contents.replace(
        /^(package .+\n)/m,
        '$1\nimport android.view.KeyEvent\n'
      );
    }

    // Add onKeyDown override (before closing brace of class)
    if (!mainActivity.contents.includes('onKeyDown')) {
      mainActivity.contents = mainActivity.contents.replace(
        /(\n}\s*$)/,
        `
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    KeyEventModule.getInstance().onKeyDownEvent(keyCode, event)
    return super.onKeyDown(keyCode, event)
  }

  override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
    KeyEventModule.getInstance().onKeyUpEvent(keyCode, event)
    return super.onKeyUp(keyCode, event)
  }
$1`
      );
    }

    return config;
  });
};
