import { useState, useEffect, useRef } from 'react';

export default function App() {
  // WebAudio refs
  const ctxRef        = useRef();
  const dryGainRef    = useRef();
  const distRef       = useRef();
  const revRef        = useRef();
  const wetGainRef    = useRef();
  const masterGainRef = useRef();
  const bufRef        = useRef();
  const srcRef        = useRef();

  // UI state
  const [loaded,   setLoaded]   = useState(false);
  const [running,  setRunning]  = useState(false);
  const [loop,     setLoop]     = useState(false);
  const [gain,     setGain]     = useState(1.0);   // master gain
  const [dryWet,   setDryWet]   = useState(0.5);   // reverb mix
  const [irLoaded, setIrLoaded] = useState(false);

  // build a soft-clip curve
  function makeDistCurve(amount = 1.0) {
    const n = 256, curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  // Setup nodes once
  useEffect(() => {
    const ctx    = new AudioContext({ latencyHint: 0.005 });
    const dist   = ctx.createWaveShaper();
    const rev    = ctx.createConvolver();
    const dryG   = ctx.createGain();
    const wetG   = ctx.createGain();
    const master = ctx.createGain();

    // initial values
    dist.curve         = makeDistCurve();
    dryG.gain.value    = 1 - dryWet;
    wetG.gain.value    = dryWet;
    master.gain.value  = gain;

    // stash
    ctxRef.current        = ctx;
    distRef.current       = dist;
    revRef.current        = rev;
    dryGainRef.current    = dryG;
    wetGainRef.current    = wetG;
    masterGainRef.current = master;

    // load default IR
    fetch('./ir.wav')
      .then(res => res.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(audioBuf => {
        rev.buffer = audioBuf;
        setIrLoaded(true);
      })
      .catch(e => console.error('Default IR load error', e));
  }, []);

  // update gains
  useEffect(() => {
    masterGainRef.current.gain.value = gain;
  }, [gain]);
  useEffect(() => {
    dryGainRef.current.gain.value = 1 - dryWet;
    wetGainRef.current.gain.value = dryWet;
  }, [dryWet]);

  // wire graph when starting
  function setupGraph(src) {
    const ctx    = ctxRef.current;
    const dist   = distRef.current;
    const rev    = revRef.current;
    const dryG   = dryGainRef.current;
    const wetG   = wetGainRef.current;
    const master = masterGainRef.current;

    // connect chain: src -> dist
    src.connect(dist);
    // dry path: dist -> dryG -> master
    dist.connect(dryG);
    dryG.connect(master);
    // wet path: dist -> rev -> wetG -> master
    dist.connect(rev);
    rev.connect(wetG);
    wetG.connect(master);
    // master to destination
    master.connect(ctx.destination);
  }

  // load sample
  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const audioBuf = await ctxRef.current.decodeAudioData(buf);
    bufRef.current = audioBuf;
    setLoaded(true);
  }

  // play
  function playSample() {
    if (!bufRef.current || running) return;
    const ctx = ctxRef.current;
    const src = ctx.createBufferSource();
    src.buffer = bufRef.current;
    src.loop = loop;
    src.onended = () => setRunning(false);
    srcRef.current = src;
    setRunning(true);
    setupGraph(src);
    src.start();
  }

  // stop
  function stopSample() {
    srcRef.current?.stop();
    setRunning(false);
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h2>🎸 Sample → Distortion → Reverb Mix → Master Out</h2>

      <div>
        <input type="file" accept="audio/*" onChange={handleFile} />
        <button onClick={playSample} disabled={!loaded || running}>
          {running ? 'Playing…' : loaded ? 'Play Sample' : 'Load Sample'}
        </button>
        <button onClick={stopSample} disabled={!running}>
          Stop
        </button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>
          <input
            type="checkbox"
            checked={loop}
            onChange={e => setLoop(e.target.checked)}
          /> Loop
        </label>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>
          Dry/Wet:&nbsp;
          <input
            type="range" min="0" max="1" step="0.01"
            value={dryWet}
            onChange={e => setDryWet(parseFloat(e.target.value))}
          /> {Math.round(dryWet * 100)}%
        </label>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <label>
          Master Gain:&nbsp;
          <input
            type="range" min="0" max="4" step="0.01"
            value={gain}
            onChange={e => setGain(parseFloat(e.target.value))}
          /> {gain.toFixed(2)}
        </label>
      </div>
    </main>
  );
}
