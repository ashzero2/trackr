const { withAndroidColors, withAndroidStyles } = require('@expo/config-plugins');
const { mkdirSync, writeFileSync, existsSync, readFileSync } = require('fs');
const { join } = require('path');

/**
 * Expo config plugin that sets android:windowBackground on the AppTheme
 * to prevent white flashes during React Navigation screen transitions.
 *
 * Usage in app.json:
 *   ["./plugins/with-android-window-background", { "light": "#f6fafe", "dark": "#0f172a" }]
 */
function withAndroidWindowBackground(config, { light = '#f6fafe', dark = '#0f172a' } = {}) {
  // Step 1: Add windowBackground color to values/colors.xml (light)
  config = withAndroidColors(config, (cfg) => {
    const colors = cfg.modResults;
    setColorValue(colors, 'windowBackground', light);
    return cfg;
  });

  // Step 2: Add windowBackground to AppTheme in styles.xml + create values-night/colors.xml
  config = withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults;

    // Add android:windowBackground to AppTheme
    const appTheme = styles.resources.style.find(
      (s) => s.$.name === 'AppTheme'
    );
    if (appTheme) {
      const existing = appTheme.item.find(
        (i) => i.$.name === 'android:windowBackground'
      );
      if (!existing) {
        appTheme.item.push({
          $: { name: 'android:windowBackground' },
          _: '@color/windowBackground',
        });
      }
    }

    // Create values-night/colors.xml for dark mode
    const resDir = join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
    const nightDir = join(resDir, 'values-night');
    mkdirSync(nightDir, { recursive: true });
    const nightColorsPath = join(nightDir, 'colors.xml');

    // If the file already exists, try to add/update the color; otherwise create it
    if (existsSync(nightColorsPath)) {
      let content = readFileSync(nightColorsPath, 'utf8');
      if (content.includes('name="windowBackground"')) {
        content = content.replace(
          /<color name="windowBackground">[^<]*<\/color>/,
          `<color name="windowBackground">${dark}</color>`
        );
      } else {
        content = content.replace(
          '</resources>',
          `  <color name="windowBackground">${dark}</color>\n</resources>`
        );
      }
      writeFileSync(nightColorsPath, content);
    } else {
      writeFileSync(
        nightColorsPath,
        `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="windowBackground">${dark}</color>\n</resources>\n`
      );
    }

    return cfg;
  });

  return config;
}

/** Helper: set or update a color in the parsed colors.xml resource object. */
function setColorValue(colors, name, value) {
  if (!colors.resources.color) {
    colors.resources.color = [];
  }
  const existing = colors.resources.color.find(
    (c) => c.$.name === name
  );
  if (existing) {
    existing._ = value;
  } else {
    colors.resources.color.push({ $: { name }, _: value });
  }
}

module.exports = withAndroidWindowBackground;