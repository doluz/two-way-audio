const WebSocket = require('ws');

const sendServer = new WebSocket.Server({ port: 4001 });
const receiveServer = new WebSocket.Server({ port: 4002 });

let browserClient = null;
let meetstreamClient = null;

function getClientIP(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

// 🎙️ SEND SERVER: Receives mic audio from browser
sendServer.on('connection', (socket, req) => {
  const ip = getClientIP(req);
  console.log(`🔗 [SEND] Mic client connected from ${ip}`);
  browserClient = socket;

  socket.on('message', msg => {
    console.log(`📥 [SEND] Received ${msg.byteLength} bytes from browser`);
    if (meetstreamClient && meetstreamClient.readyState === WebSocket.OPEN) {
      meetstreamClient.send(msg);
      console.log(`📤 [SEND] Forwarded ${msg.byteLength} bytes to MeetStream`);
    } else {
      console.warn('⚠️ [SEND] MeetStream not connected or ready');
    }
  });

  socket.on('close', () => {
    console.log(`❌ [SEND] Mic client from ${ip} disconnected`);
    browserClient = null;
  });
});

// 🔈 RECEIVE SERVER: Sends audio from MeetStream to browser
receiveServer.on('connection', (socket, req) => {
  const ip = getClientIP(req);
  console.log(`🔗 [RECEIVE] MeetStream client connected from ${ip}`);
  meetstreamClient = socket;

  socket.on('message', msg => {
    console.log(`📥 [RECEIVE] Received ${msg.byteLength} bytes from MeetStream`);
    if (browserClient && browserClient.readyState === WebSocket.OPEN) {
      browserClient.send(msg);
      console.log(`📤 [RECEIVE] Forwarded ${msg.byteLength} bytes to browser`);
    } else {
      console.warn('⚠️ [RECEIVE] Browser not connected or ready');
    }
  });

  socket.on('close', () => {
    console.log(`❌ [RECEIVE] MeetStream client from ${ip} disconnected`);
    meetstreamClient = null;
  });
});

console.log('🟢 WebSocket server running');
console.log('🔊 Listening on:');
console.log('  → ws://localhost:4001  (browser to MeetStream via /send)');
console.log('  → ws://localhost:4002  (MeetStream to browser via /receive)');
