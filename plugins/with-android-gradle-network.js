const { withGradleProperties } = require('@expo/config-plugins');

/** Longer Gradle HTTP timeouts for slow artifact hosts (e.g. optional JitPack deps). */
function withAndroidGradleNetwork(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const upsert = (key, value) => {
      const i = props.findIndex((p) => p.type === 'property' && p.key === key);
      const entry = { type: 'property', key, value };
      if (i >= 0) props[i] = entry;
      else props.push(entry);
    };
    upsert('systemProp.org.gradle.internal.http.connectionTimeout', '300000');
    upsert('systemProp.org.gradle.internal.http.socketTimeout', '300000');
    return cfg;
  });
}

module.exports = withAndroidGradleNetwork;
