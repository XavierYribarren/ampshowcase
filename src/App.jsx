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
import Scene from './features/canvas/Scene';

export default function App() {
  // ——— Audio engine & Faust ———
  const [audioContext,  setAudioContext]  = useState(null);
  const [faustCompiler, setFaustCompiler] = useState(null);
  const [faustFactory,  setFaustFactory]  = useState(null);

  // ——— TubeAmp→Cabinet ends ———
  const [tubeNode,           setTubeNode]           = useState(null);
  const [preampConvolver,    setPreampConvolver]    = useState(null);
  const [bypass, setBypass] = useState(false);

  // ——— Sample player refs & UI ———
  const masterGainRef = useRef(null);
  const bufRef        = useRef(null);
  const srcRef        = useRef(null);
  const startTimeRef  = useRef(0);
  const cabinetConvolverRef = useRef(null);

  const destRef     = useRef(null);  // MediaStreamAudioDestinationNode
  const audioElRef = useRef(null);   // HTMLAudioElement

  const [loaded,  setLoaded]  = useState(false);
  const [running, setRunning] = useState(false);
  const [loop,    setLoop]    = useState(false);
  const [gain,    setGain]    = useState(8.0);

  // Playback progress
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration   ] = useState(0);

  // Slider state for 3D knobs
  const [sliderMeta, setSliderMeta] = useState([]);
  const [sliderVals, setSliderVals] = useState({});
  const tubeRef = useRef(null);

  // 1) On mount, create AudioContext + masterGain + Faust
  useEffect(() => {
    const ctx = new AudioContext({ latencyHint: 0.005 });
    setAudioContext(ctx);

    // master gain node (final out)
    const master = ctx.createGain();
    master.gain.value = gain;
    masterGainRef.current = master;

    const cab = ctx.createConvolver();
    cabinetConvolverRef.current = cab;

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
    setDuration(audioBuf.duration);
    setLoaded(true);
  }

  // Progress updater
  function updateProgress() {
    if (running && srcRef.current) {
      const elapsed = audioContext.currentTime - startTimeRef.current;
      setCurrentTime(elapsed);
      if (elapsed < duration) requestAnimationFrame(updateProgress);
    }
  }

  // 4) Play the sample
  async function playSample() {
    if (!audioContext || !bufRef.current || running) return;
    await audioContext.resume();

    masterGainRef.current.disconnect();

    if (!destRef.current) {
      const dest = audioContext.createMediaStreamDestination();
      destRef.current = dest;

      const a = new Audio();
      a.muted     = true;
      a.srcObject = dest.stream;
      audioElRef.current = a;
    }

    const src = audioContext.createBufferSource();
    src.buffer = bufRef.current;
    src.loop   = loop;
    src.onended = () => stopSample();

    if (bypass) {
      src.connect(masterGainRef.current);
      masterGainRef.current.connect(audioContext.destination);
    } else {
      src
        .connect(tubeNode)
        .connect(preampConvolver)
        .connect(cabinetConvolverRef.current)
        .connect(masterGainRef.current);
      masterGainRef.current.connect(destRef.current);
    }

    srcRef.current = src;
    startTimeRef.current = audioContext.currentTime;

    src.start();
    setRunning(true);
    audioElRef.current?.play().catch(() => {});

    requestAnimationFrame(updateProgress);
  }

  // 5) Stop sample
  function stopSample() {
    srcRef.current?.stop();
    setRunning(false);
    setCurrentTime(0);
  }

  // Slider callbacks
  const handleSlidersReady = meta => {
    setSliderMeta(meta);
    setSliderVals(Object.fromEntries(meta.map(m => [m.address, m.init])));
    handleSlidersReady.ref = tubeRef;
  };

  const handleSliderDrag = (addr, val) => {
    tubeRef.current?.setParam(addr, val);
    setSliderVals(vals => ({ ...vals, [addr]: val }));
  };

  return (
    <div className="App-main">
      <main className='main-wrap' style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
     <div className='select'>

        <h2>🎸 Sample → TubeAmp + Cabinet → Master Out</h2>

        <div>
          <input type="file" accept="audio/*" onChange={handleFile} />
          <button onClick={playSample} disabled={!loaded || running}>
            {running ? 'Playing…' : loaded ? 'Play Sample' : 'Load Sample'}
          </button>
          <button onClick={stopSample} disabled={!running}>Stop</button>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label>
            <input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} /> Loop
          </label>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label>
            Master Gain:&nbsp;
            <input
              type="range" min="0" max="10" step="0.01"
              value={gain}
              onChange={e => setGain(parseFloat(e.target.value))}
            /> {gain.toFixed(2)}
          </label>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label>
            <input
              type="checkbox"
              checked={bypass}
              onChange={e => setBypass(e.target.checked)}
              /> Bypass Amp (direct sound)
          </label>
        </div>
    
        {/* Progress bar & timer */}

        {/* Mount AmpCab only once Faust is ready */}
        {audioContext && faustCompiler && faustFactory && (
          <AmpCab
          audioContext={audioContext}
            faustCompiler={faustCompiler}
            faustFactory={faustFactory}
            onPluginReady={([preConv, fNode]) => {
              setPreampConvolver(preConv);
              setTubeNode(fNode);
            }}
            cabinetConvolver={cabinetConvolverRef.current}
            tubeRef={tubeRef}
            onSlidersReady={handleSlidersReady}
            onSliderChange={handleSliderDrag}
            />
          )}
          </div>
        <div style={{ marginTop: '1rem', }} className='trackviz'>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={Math.min(currentTime, duration)}
            readOnly
            style={{ width: '100%' }}
          />
          <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
            {new Date(currentTime * 1000).toISOString().substr(14, 5)} /
            {new Date(duration    * 1000).toISOString().substr(14, 5)}
          </div>
        </div>
      </main>

      {/* 3D scene with knobs */}
      <Scene
        audioContext={audioContext}
        mediaStream={destRef.current?.stream}
        sliders={sliderMeta}
        values={sliderVals}
        onDragSlider={handleSliderDrag}
      />
    </div>
  );
}
