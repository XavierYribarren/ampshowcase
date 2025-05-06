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
  // const [cabinetConvolver,   setCabinetConvolver]   = useState(null);
  const [bypass, setBypass] = useState(false);
  const [isChainReady, setChainReady] = useState(false)
  // const chainReady = Boolean(
  //      tubeNode && preampConvolver && cabinetConvolver
  //    );
    

  // ——— Sample player refs & UI ———
  const masterGainRef = useRef(null);
  const bufRef        = useRef(null);
  const srcRef        = useRef(null);
  const cabinetConvolverRef = useRef(null);

  const destRef     = useRef(null)  // MediaStreamAudioDestinationNode
  const audioElRef = useRef(null)   // HTMLAudioElement


  const [loaded,  setLoaded]  = useState(false);
  const [running, setRunning] = useState(false);
  const [loop,    setLoop]    = useState(false);
  const [gain,    setGain]    = useState(1.0);


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
    // master.connect(ctx.destination);
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
    setLoaded(true);
  }



  async function playSample() {
    // ➊ make sure we have everything
    if (!audioContext || !bufRef.current || running) return;
    await audioContext.resume();
  
    // ➋ disconnect any old masterGain → destination / MediaStream
    masterGainRef.current.disconnect();
  
    // ➌ create your destination only the first time
    if (!destRef.current) {
      // audioContext is guaranteed non-null here
      const dest = audioContext.createMediaStreamDestination();
      destRef.current = dest;
  
      // optional hidden <audio> for autoplay unlocking
      const a = new Audio();
      a.muted     = true;
      a.srcObject = dest.stream;
      audioElRef.current = a;
    }
  
    const src = audioContext.createBufferSource();
    src.buffer = bufRef.current;
    src.loop   = loop;
    src.onended = () => setRunning(false);
  
    if (bypass) {
      // direct path
      src.connect(masterGainRef.current);
      masterGainRef.current.connect(audioContext.destination);
    } else {
      // processed path
      src
        .connect(tubeNode)
        .connect(preampConvolver)
        .connect(cabinetConvolverRef.current)
        .connect(masterGainRef.current);
  
      // fan-out into your MediaStream
      masterGainRef.current.connect(destRef.current);
    }
  
    // ➍ now you can start both the node AND the <audio> unlock
    src.start();
    setRunning(true);
  
    audioElRef.current?.play().catch(() => {});
  }
  
  function stopSample() {
    srcRef.current?.stop();
    setRunning(false);
  }

  const handleSlidersReady = meta => {
    // console.table(meta.map(({ label, address, type }) => ({ label, address, type })));
    setSliderMeta(meta);
    setSliderVals(Object.fromEntries(meta.map(m => [m.address, m.init])));
    handleSlidersReady.ref = tubeRef;      // exposes TubeAmp.setParam
  };
  
  const handleSliderDrag = (addr, val) => {
    // setSliderVals(vs => ({ ...vs, [addr]: val }));
    tubeRef.current?.setParam(addr, val);  // updates Faust
    setSliderVals(vals => ({ ...vals, [addr]: val }));
    console.log('drag -> parent', addr, val);
  };
  

  return (
    <div className="App-main">
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }} className='main-wrap'>
    <div className="ampheader">

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
      <div style={{ marginTop: '1rem' }}>
  <label>
    <input
      type="checkbox"
      checked={bypass}
      onChange={e => setBypass(e.target.checked)}
      /> Bypass Amp (direct sound)
  </label>
      </div>
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
          cabinetConvolver={cabinetConvolverRef.current}
          
          tubeRef={tubeRef}                 // ← new prop
          onSlidersReady={handleSlidersReady}
          onSliderChange={handleSliderDrag}
        />
      )}
     
    </main>
    {/* {destRef.current && ( */}
  <Scene
    audioContext={audioContext}
    mediaStream={destRef.current?.stream}
    sliders={sliderMeta}
    values={sliderVals}
    onDragSlider={handleSliderDrag}
  />
{/* )} */}
    </div>
  );
}
