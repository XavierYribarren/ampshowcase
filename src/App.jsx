// src/App.jsx
import { useState, useRef, useEffect } from 'react';

export default function App() {
  const ctxRef     = useRef(null);
  const gainRef    = useRef(null);
  const revRef     = useRef(null);
  const mergerRef  = useRef(null);
  const srcRef     = useRef(null);

  const [started,   setStarted]   = useState(false);
  const [gain,      setGain]      = useState(0.8);
  const [reverbOn,  setReverbOn]  = useState(true);

  // 1. One-time setup: context + nodes + load IR
  useEffect(() => {
    const ctx    = new AudioContext({
      latencyHint: 0.002,      // ideal 5 ms RT latency
      sampleRate: 48000        // match your audio interface if possible
    });
    const gainN  = ctx.createGain();
    const revN   = ctx.createConvolver();
    const mergeN = ctx.createChannelMerger(2);

    gainN.gain.value = gain;

    // load the impulse response
    fetch('/ir.wav')
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(audioBuf => { revN.buffer = audioBuf; })
      .catch(console.error);

    ctxRef.current    = ctx;
    gainRef.current   = gainN;
    revRef.current    = revN;
    mergerRef.current = mergeN;
  }, []); // ← run once

  // 2. Update gain in real time
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = gain;
  }, [gain]);

  // 3. Re-route whenever reverbOn or after start
  useEffect(() => {
    if (!started) return;
    const ctx   = ctxRef.current;
    const gainN = gainRef.current;
    const revN  = revRef.current;
    const merge = mergerRef.current;

    // clear old connections
    gainN.disconnect();
    revN.disconnect();
    merge.disconnect();

    // always connect merger → destination
    merge.connect(ctx.destination);

    if (reverbOn) {
      // gain → reverb → merger (L & R)
      gainN.connect(revN);
      revN.connect(merge, 0, 0);
      revN.connect(merge, 0, 1);
    } else {
      // gain → merger directly (L & R)
      gainN.connect(merge, 0, 0);
      gainN.connect(merge, 0, 1);
    }
  }, [reverbOn, started]);

  // 4. Start button handler: get mic + wire the top of the graph
  async function start() {
    if (started) return;
    setStarted(true);

    const ctx = ctxRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation:    false,
        noiseSuppression:    false,
        autoGainControl:     false
      }
    });

    const src = ctx.createMediaStreamSource(stream);
    srcRef.current = src;

    // top-of-graph: mic → gain
    src.connect(gainRef.current);

    // then let the useEffect hook do the rest
    await ctx.resume();
  }

  return (
    <main style={{ fontFamily:'sans-serif', padding:'2rem', lineHeight:1.6 }}>
      <h2>🎤 Live Mic → Gain → {reverbOn ? 'Reverb' : 'Dry'}</h2>
      <button onClick={start} disabled={started}>
        {started ? 'Mic Running…' : 'Start Microphone'}
      </button>

      <div style={{ marginTop: '1rem' }}>
        <label>
          Gain:&nbsp;
          <input
            type="range" min="0" max="4" step="0.01"
            value={gain}
            onChange={e => setGain(parseFloat(e.target.value))}
          />
          &nbsp;{gain.toFixed(2)}
        </label>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <label>
          <input
            type="checkbox"
            checked={reverbOn}
            onChange={e => setReverbOn(e.target.checked)}
          />
          &nbsp;Reverb On
        </label>
      </div>
    </main>
  );
}
