// Prints this computer's LAN IP. Runs on the host before `docker compose up`,
// because the container can only see its own internal address.
const dgram = require('dgram');
const os = require('os');

function fromInterfaces() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return '';
}

// "Connecting" a UDP socket sends nothing, but makes the OS pick the
// interface it would use to reach the network, which is the LAN one.
const sock = dgram.createSocket('udp4');
const done = (ip) => { console.log(ip); try { sock.close(); } catch {} };
sock.on('error', () => done(fromInterfaces()));
sock.connect(53, '192.0.2.1', () => {
  const ip = sock.address().address;
  done(ip && ip !== '0.0.0.0' ? ip : fromInterfaces());
});
