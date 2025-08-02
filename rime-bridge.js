
const puppeteer = require('puppeteer');

const GCP_IP = 'YOUR.GCP.IP.HERE'; // change this
const WS_SEND = `ws://${GCP_IP}:4001`;
const WS_RECEIVE = `ws://${GCP_IP}:4002`;

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--use-fake-ui-for-media-stream']
  });

  const page = await browser.newPage();
  await page.goto('https://www.rime.ai/', { waitUntil: 'networkidle2' });

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('live chat'));
    if (btn) btn.click();
  });

  await page.waitForTimeout(5000);

  await page.evaluate((WS_SEND, WS_RECEIVE) => {
    const micSocket = new WebSocket(WS_SEND);
    const speakerSocket = new WebSocket(WS_RECEIVE);

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);

      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = e => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcm[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        micSocket.readyState === 1 && micSocket.send(pcm.buffer);
      };
    });

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
  }, WS_SEND, WS_RECEIVE);

  console.log('🧠 Rime voice bridge active. Streaming audio in/out.');
})();
