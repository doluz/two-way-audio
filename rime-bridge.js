const puppeteer = require('puppeteer');

const GCP_IP = '34.136.143.41'; // replace if needed
const WS_SEND = `ws://${GCP_IP}:4001`; // mic audio to server
const WS_RECEIVE = `ws://${GCP_IP}:4002`; // speaker audio from server

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  const page = await browser.newPage();

  // Browser logs
  page.on('console', msg => console.log('🧠 BROWSER:', msg.text()));
  page.on('pageerror', err => console.error('🔴 PAGE ERROR:', err));

  await page.goto('https://www.rime.ai/', { waitUntil: 'networkidle2' });
  console.log("✅ Page loaded. Clicking button...");

  await page.mouse.click(100, 100); // simulate user interaction
  await page.keyboard.press('Enter'); // simulate user interaction

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.textContent.toLowerCase().includes('live chat'));
    if (btn) btn.click();
  });

  console.log("✅ Live Chat button clicked. Evaluating audio script...");

  await page.evaluate((WS_SEND, WS_RECEIVE) => {
    console.log("✅ Starting browser-side WebSocket + audio init...");

    const micSocket = new WebSocket(WS_SEND);
    const speakerSocket = new WebSocket(WS_RECEIVE);

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);

      console.log("🧠 BROWSER: publishing track", stream.getAudioTracks()[0]);

      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = e => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcm[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }

        if (pcm.some(sample => sample !== 0)) {
          console.log("🧠 BROWSER: sending mic data", pcm.length);
        } else {
          console.log("🧠 BROWSER: silence detected on local audio track", stream.getAudioTracks()[0]);
        }

        if (micSocket.readyState === 1) micSocket.send(pcm.buffer);
      };
    });

    const audioCtxOut = new AudioContext({ sampleRate: 16000 });
    speakerSocket.binaryType = 'arraybuffer';

    speakerSocket.onmessage = (event) => {
      console.log("🧠 BROWSER: received speaker data", event.data.byteLength);

      const pcm = new Int16Array(event.data);
      const float32 = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) {
        float32[i] = pcm[i] / 0x7FFF;
      }

      const buffer = audioCtxOut.createBuffer(1, float32.length, 16000);
      buffer.copyToChannel(float32, 0);
      const src = audioCtxOut.createBufferSource();
      src.buffer = buffer;
      src.connect(audioCtxOut.destination);
      src.start();
    };
  }, WS_SEND, WS_RECEIVE);

  console.log("✅ evaluate() completed. Audio bridge active.");
})();
