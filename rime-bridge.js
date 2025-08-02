const puppeteer = require('puppeteer');

const GCP_IP = '34.136.143.41';
const WS_SEND = `ws://${GCP_IP}:4001`;
const WS_RECEIVE = `ws://${GCP_IP}:4002`;

console.log('Puppeteer Executable Path:', puppeteer.executablePath());

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/sidhdharth/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream', // auto-allow mic
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();
  await page.goto('https://www.rime.ai/', { waitUntil: 'networkidle2' });

  // Click the "Try Live Chat" button
  const buttons = await page.$$('button');
  let found = false;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.toLowerCase().includes('live chat')) {
      await btn.click();
      found = true;
      break;
    }
  }

  if (!found) {
    console.error('❌ Could not find "Try Live Chat" button.');
    return;
  }

  console.log('✅ Live Chat button clicked. Injecting audio bridge...');

  // Wait for iframe or chat UI to load (adjust selector based on Rime's site structure)
  await page.waitForTimeout(3000);

  // Inject actual audio code into browser context
  await page.evaluate((WS_SEND, WS_RECEIVE) => {
    (async () => {
      try {
        const micSocket = new WebSocket(WS_SEND);
        const speakerSocket = new WebSocket(WS_RECEIVE);

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);

        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          if (micSocket.readyState === 1) micSocket.send(pcm.buffer);
        };

        const audioCtxOut = new AudioContext({ sampleRate: 16000 });
        speakerSocket.binaryType = 'arraybuffer';

        speakerSocket.onmessage = (event) => {
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

        console.log('🎤 Microphone and WebSocket setup complete!');
      } catch (err) {
        console.error('🔥 Error inside browser context:', err);
      }
    })();
  }, WS_SEND, WS_RECEIVE);

  console.log('🧠 Rime voice bridge active. Streaming audio in/out.');
})();
