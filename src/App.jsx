// src/App.jsx
import { useState, useEffect, useRef } from 'react';

export default function App() {
  const ctxRef   = useRef(null);
  const gainRef  = useRef(null);
  const bufRef   = useRef(null);
  const srcRef   = useRef(null);

  const [loaded, setLoaded] = useState(false);
  const [gain,   setGain]   = useState(1.0);

  // 1️⃣ One-time setup: AudioContext + GainNode
  useEffect(() => {
    const ctx      = new AudioContext();
    const gainNode = ctx.createGain();
    gainNode.gain.value = gain;

    ctxRef.current  = ctx;
    gainRef.current = gainNode;
  }, []);

  // 2️⃣ Update gain live
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = gain;
  }, [gain]);

  // 3️⃣ Handle file load
  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const audioBuf = await ctxRef.current.decodeAudioData(arrayBuffer);
    bufRef.current = audioBuf;
    setLoaded(true);
  }

  // 4️⃣ Play the sample
  function playSample() {
    if (!bufRef.current) return;

    // stop any previous playback
    if (srcRef.current) {
      try { srcRef.current.stop(); }
      catch {}
    }

    const ctx    = ctxRef.current;
    const src    = ctx.createBufferSource();
    src.buffer   = bufRef.current;
    src.loop     = false;

    // stereo-preserving chain: BufferSource → Gain → destination
    src.connect(gainRef.current).connect(ctx.destination);

    src.start();
    srcRef.current = src;
  }

  return (
    <main style={{ fontFamily:'sans-serif', padding:'2rem', lineHeight:1.6 }}>
      <h2>🎸 Sample Player with Gain Control</h2>

      <div>
        <input type="file" accept="audio/*" onChange={handleFile} />
        &nbsp;
        <button onClick={playSample} disabled={!loaded}>
          {loaded ? 'Play Sample' : 'Load a sample…'}
        </button>
      </div>

      <div style={{ marginTop:'1rem' }}>
        <label>
          Gain:&nbsp;
          <input
            type="range" min="0" max="2" step="0.01"
            value={gain}
            onChange={e => setGain(parseFloat(e.target.value))}
          />
          &nbsp;{gain.toFixed(2)}
        </label>
      </div>
    </main>
  );
}
