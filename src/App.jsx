// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import AmpCab from './AmpCab';
import {
  instantiateFaustModuleFromFile,
  LibFaust,
  FaustCompiler,
  FaustMonoDspGenerator
} from '@grame/faustwasm';
// Vite will give us the final URL at runtime
import libfaustUrl from '@grame/faustwasm/libfaust-wasm/libfaust-wasm.js?url';
import './App.css';

export default function App() {
  // ——— Audio engine & Faust ———
  const [audioContext,  setAudioContext]  = useState(null);
  const [faustCompiler, setFaustCompiler] = useState(null);
  const [faustFactory,  setFaustFactory]  = useState(null);

  // ——— TubeAmp→Cabinet ends ———
  const [tubeNode,           setTubeNode]           = useState(null);
  const [preampConvolver,    setPreampConvolver]    = useState(null);
  const [cabinetConvolver,   setCabinetConvolver]   = useState(null);

  const chainReady = Boolean(
       tubeNode && preampConvolver && cabinetConvolver
     );
    

  // ——— Sample player refs & UI ———
  const masterGainRef = useRef(null);
  const bufRef        = useRef(null);
  const srcRef        = useRef(null);

  const [loaded,  setLoaded]  = useState(false);
  const [running, setRunning] = useState(false);
  const [loop,    setLoop]    = useState(false);
  const [gain,    setGain]    = useState(1.0);

  // 1) On mount, create AudioContext + masterGain + Faust
  useEffect(() => {
    const ctx = new AudioContext({ latencyHint: 0.005 });
    setAudioContext(ctx);

    // master gain node (final out)
    const master = ctx.createGain();
    master.gain.value = gain;
    master.connect(ctx.destination);
    masterGainRef.current = master;

    // init Faust
    instantiateFaustModuleFromFile(libfaustUrl)
      .then(Module => {
        const lib      = new LibFaust(Module);
        const compiler = new FaustCompiler(lib);
        const factory  = new FaustMonoDspGenerator();
        setFaustCompiler(compiler);
        setFaustFactory(factory);
      })
      .catch(err => console.error('Faust init error:', err));

    return () => ctx.close();
  }, []);

  // 2) Update master gain if slider moves
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = gain;
    }
  }, [gain]);
  function decodeAudioDataPromise(ctx, arrayBuffer) {
    return new Promise((resolve, reject) => {
      ctx.decodeAudioData(arrayBuffer, resolve, reject);
    });
  }

  // 3) File-picker handler
  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file || !audioContext) return;
    const arrayBuffer = await file.arrayBuffer();
      let audioBuf;
      try {
        audioBuf = await decodeAudioDataPromise(audioContext, arrayBuffer);
      } catch(err) {
        console.error("decodeAudioData failed:", err);
        return;
      }
      bufRef.current = audioBuf;
    setLoaded(true);
  }

  // 4) Play the sample _through_ your AmpCab chain
  async function playSample() {
    if (!bufRef.current || running || !audioContext) return;
  
    // <-- this line is crucial:
    await audioContext.resume();
  
    console.log('▶️ playSample, chain is:', {
      tubeNode,
      preampConvolver,
      cabinetConvolver,
      master: masterGainRef.current
    });
    
    const src = audioContext.createBufferSource();
    src.buffer = bufRef.current;
    src.loop   = loop;
    src.onended = () => setRunning(false);
  
    // decide whether to run through AmpCab or bypass
    // if (tubeNode && preampConvolver && cabinetConvolver) {
    //   // existing chain
    //   src
    //     .connect(tubeNode)
    //     .connect(preampConvolver)
    //     .connect(cabinetConvolver)
    //     .connect(masterGainRef.current);
    // } else {
    //   // ☆ BYPASS: connect straight to masterGain
    //   src.connect(masterGainRef.current);
    // }
    src
    .connect(tubeNode)
    .connect(preampConvolver)
    .connect(cabinetConvolver)
    .connect(masterGainRef.current);

    srcRef.current = src;
    setRunning(true);
    src.start();
  }
  function stopSample() {
    srcRef.current?.stop();
    setRunning(false);
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h2>🎸 Sample → TubeAmp + Cabinet → Master Out</h2>

      {/* File loader + Play/Stop */}
      <div>
        <input type="file" accept="audio/*" onChange={handleFile} />
        <button onClick={playSample} disabled={!loaded || running}>
          {running ? 'Playing…' : loaded ? 'Play Sample' : 'Load Sample'}
        </button>
        <button onClick={stopSample} disabled={!running}>
          Stop
        </button>
      </div>

      {/* Loop toggle */}
      <div style={{ marginTop: '1rem' }}>
        <label>
          <input
            type="checkbox"
            checked={loop}
            onChange={e => setLoop(e.target.checked)}
          /> Loop
        </label>
      </div>

      {/* Master gain slider */}
      <div style={{ marginTop: '1rem' }}>
        <label>
          Master Gain:&nbsp;
          <input
            type="range"
            min="0" max="10" step="0.01"
            value={gain}
            onChange={e => setGain(parseFloat(e.target.value))}
          /> {gain.toFixed(2)}
        </label>
      </div>

      {/* Mount AmpCab only once Faust is ready */}
      {audioContext && faustCompiler && faustFactory && (
        <AmpCab
          audioContext={audioContext}
          faustCompiler={faustCompiler}
          faustFactory={faustFactory}
          // get [preampConvolver, faustNode]
          onPluginReady={([preampConv, faustNode]) => {
            // we'll wire in playSample()
            setPreampConvolver(preampConv);
            setTubeNode(faustNode);
          }}
          // get the final cabinet ConvolverNode
          onCabReady={setCabinetConvolver}
        />
      )}
    </main>
  );
}
