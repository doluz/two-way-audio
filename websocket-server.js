
const WebSocket = require('ws');

const sendServer = new WebSocket.Server({ port: 4001 });
const receiveServer = new WebSocket.Server({ port: 4002 });

let browserClient = null;
let meetstreamClient = null;

sendServer.on('connection', socket => {
  console.log('🔗 Mic client connected to /send');
  browserClient = socket;

  socket.on('message', msg => {
    if (meetstreamClient && meetstreamClient.readyState === WebSocket.OPEN) {
      meetstreamClient.send(msg);
    }
  });

  socket.on('close', () => {
    console.log('❌ Mic client disconnected');
    browserClient = null;
  });
});

receiveServer.on('connection', socket => {
  console.log('🔗 MeetStream connected to /receive');
  meetstreamClient = socket;

  socket.on('message', msg => {
    if (browserClient && browserClient.readyState === WebSocket.OPEN) {
      browserClient.send(msg);
    }
  });

  socket.on('close', () => {
    console.log('❌ MeetStream disconnected');
    meetstreamClient = null;
  });
});

console.log('🟢 WebSocket server running');
console.log('🔊 Listening on:');
console.log('  → ws://localhost:4001  (browser to MeetStream)');
console.log('  → ws://localhost:4002  (MeetStream to browser)');
