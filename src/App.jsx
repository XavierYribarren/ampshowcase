// src/App.jsx
import { useState, useEffect, useRef } from 'react';

export default function App() {
  const ctxRef    = useRef(null);
  const bpRef     = useRef(null);   // band-pass filter
  const driveRef  = useRef(null);   // waveshaper
  const gainRef   = useRef(null);   // gain node
  const revRef    = useRef(null);   // convolver
  const mergeRef  = useRef(null);   // channel merger

  const [started,  setStarted]  = useState(false);
  const [driveAmt, setDriveAmt] = useState(400);
  const [gain,     setGain]     = useState(0.8);
  const [reverbOn, setReverbOn] = useState(true);

  // build a distortion curve (soft-clip)
  function makeDistCurve(amount) {
    const n = 256, curve = new Float32Array(n);
    const deg = Math.PI/180;
    for (let i = 0; i < n; ++i) {
      const x = (i*2)/n - 1;
      curve[i] = ((3+amount)*x*20*deg)/(Math.PI + amount*Math.abs(x));
    }
    return curve;
  }

  // 1️⃣ One-time setup: context, nodes, load IR
  useEffect(() => {
    const ctx       = new AudioContext({ latencyHint: 0.002
     });
    const bp        = ctx.createBiquadFilter();
    const drive     = ctx.createWaveShaper();
    const gainNode  = ctx.createGain();
    const rev       = ctx.createConvolver();
    const merger    = ctx.createChannelMerger(2);

    // configure band-pass for “telephone” band
    bp.type              = 'bandpass';
    bp.frequency.value   = 800;
    bp.Q.value           = 1;

    // configure drive
    drive.curve        = makeDistCurve(driveAmt);
    drive.oversample   = '4x';

    // configure gain
    gainNode.gain.value = gain;

    // load impulse
    fetch('/ir.wav')
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(audioBuf => { rev.buffer = audioBuf; })
      .catch(console.error);

    // stash refs
    ctxRef.current   = ctx;
    bpRef.current    = bp;
    driveRef.current = drive;
    gainRef.current  = gainNode;
    revRef.current   = rev;
    mergeRef.current = merger;
  }, []); // run once

  // 2️⃣ update curves & gains in real time
  useEffect(() => {
    if (driveRef.current) driveRef.current.curve = makeDistCurve(driveAmt);
  }, [driveAmt]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = gain;
  }, [gain]);

  // 3️⃣ reroute on reverb toggle (after start)
  useEffect(() => {
    if (!started) return;
    const ctx      = ctxRef.current;
    const gainNode = gainRef.current;
    const rev      = revRef.current;
    const merger   = mergeRef.current;

    // clear old connections
    gainNode.disconnect();
    rev.disconnect();
    merger.disconnect();

    // always: merger → destination
    merger.connect(ctx.destination);

    if (reverbOn) {
      // wet path
      gainNode.connect(rev);
      rev.connect(merger, 0, 0);
      rev.connect(merger, 0, 1);
    } else {
      // dry path
      gainNode.connect(merger, 0, 0);
      gainNode.connect(merger, 0, 1);
    }
  }, [reverbOn, started]);

  // 4️⃣ start the mic & wire top of graph
  async function start() {
    if (started) return;
    setStarted(true);

    const ctx = ctxRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    const src = ctx.createMediaStreamSource(stream);

    // mic → bp → drive → gain
    src.connect(bpRef.current)
       .connect(driveRef.current)
       .connect(gainRef.current);

    await ctx.resume();
  }

  return (
    <main style={{ fontFamily:'sans-serif', padding:'2rem', lineHeight:1.6 }}>
      <h2>
        🎤 Mic → Telephone Drive → Gain → {reverbOn ? 'Reverb' : 'Dry'}
      </h2>

      <button onClick={start} disabled={started}>
        {started ? 'Running…' : 'Start Microphone'}
      </button>

      <div style={{ marginTop:'1rem' }}>
        <label>
          Drive:&nbsp;
          <input
            type="range" min="0" max="1000" step="1"
            value={driveAmt}
            onChange={e => setDriveAmt(+e.target.value)}
          />
          &nbsp;{driveAmt}
        </label>
      </div>

      <div style={{ marginTop:'0.5rem' }}>
        <label>
          Gain:&nbsp;
          <input
            type="range" min="0" max="4" step="0.01"
            value={gain}
            onChange={e => setGain(+e.target.value)}
          />
          &nbsp;{gain.toFixed(2)}
        </label>
      </div>

      <div style={{ marginTop:'0.5rem' }}>
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
