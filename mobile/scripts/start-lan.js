const os = require('os');
const { spawn } = require('child_process');

function pickLanIp() {
  const interfaces = os.networkInterfaces();
  const preferred = ['Wi-Fi', 'WLAN', 'Ethernet'];

  for (const prefix of preferred) {
    const key = Object.keys(interfaces).find((name) => name.toLowerCase().includes(prefix.toLowerCase()));
    if (!key) continue;
    const match = (interfaces[key] || []).find(
      (addr) => addr && addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.'),
    );
    if (match) return match.address;
  }

  for (const name of Object.keys(interfaces)) {
    const match = (interfaces[name] || []).find(
      (addr) => addr && addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.'),
    );
    if (match) return match.address;
  }

  return null;
}

const ip = pickLanIp();

if (!ip) {
  console.error('Could not auto-detect LAN IP. Run ipconfig and set EXPO_PUBLIC_MOBILE_API_BASE_URL manually.');
  process.exit(1);
}

const env = {
  ...process.env,
  EXPO_PUBLIC_MOBILE_API_BASE_URL: `http://${ip}:4000`,
  REACT_NATIVE_PACKAGER_HOSTNAME: ip,
};

console.log(`Using LAN IP: ${ip}`);
console.log(`API base: ${env.EXPO_PUBLIC_MOBILE_API_BASE_URL}`);

const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const args =
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx expo start --lan --port 8081 -c']
    : ['expo', 'start', '--lan', '--port', '8081', '-c'];

const child = spawn(command, args, {
  stdio: 'inherit',
  env,
  shell: false,
});

child.on('exit', (code) => process.exit(code ?? 0));
