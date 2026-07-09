import { NativeModules, Platform } from 'react-native';

const localhostHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function getScriptHost() {
  const scriptURL: string = NativeModules?.SourceCode?.scriptURL ?? '';
  const match = scriptURL.match(/https?:\/\/([^/:]+)/);
  const hostFromScript = match?.[1]?.trim() ?? '';
  const hostFromEnv = process.env.REACT_NATIVE_PACKAGER_HOSTNAME?.trim() ?? '';
  return hostFromScript || hostFromEnv;
}

export function getApiBaseUrl() {
  const explicitBaseUrl = process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL?.trim() ?? '';
  const scriptHost = getScriptHost();

  if (explicitBaseUrl) {
    try {
      const explicit = new URL(explicitBaseUrl);
      if (localhostHosts.has(explicit.hostname) && scriptHost && !localhostHosts.has(scriptHost)) {
        return `${explicit.protocol}//${scriptHost}:${explicit.port || '4000'}`;
      }
      return explicitBaseUrl;
    } catch {
      // Fall through to platform/script-host defaults.
    }
  }

  if (scriptHost && !localhostHosts.has(scriptHost)) {
    return `http://${scriptHost}:4000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }

  return 'http://localhost:4000';
}
