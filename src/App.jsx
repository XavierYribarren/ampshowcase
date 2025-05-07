// src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import Waveform from './features/controls/WaveForm';
import WaveForm from './features/controls/WaveForm';

export default function App() {
  // ——— Audio engine & Faust ———
  const [audioContext,  setAudioContext]  = useState(null);
  const [faustCompiler, setFaustCompiler] = useState(null);
  const [faustFactory,  setFaustFactory]  = useState(null);

  const [audioFile, setAudioFile] = useState(null);


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
  const analyserRef = useRef(null);

  const destRef     = useRef(null);  // MediaStreamAudioDestinationNode
  const audioElRef = useRef(null);   // HTMLAudioElement
  const slidersReadyRef = useRef();
  const stoppedRef = useRef(false);

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
    setAudioFile(file);
    setLoaded(true);
  }

  // Progress updater
  useEffect(() => {
    let rafId;
    const update = () => {
      if (running && audioContext) {
        const elapsed = audioContext.currentTime - startTimeRef.current;
        setCurrentTime(elapsed);
        rafId = requestAnimationFrame(update);
      }
    };
  
    if (running) {
      rafId = requestAnimationFrame(update);
    }
  
    return () => cancelAnimationFrame(rafId);
  }, [running, audioContext]);
  // 4) Play the sample
  async function playSample(restart = false) {
    if (!audioContext || !bufRef.current) return;
    if (!restart && running) return;
    stoppedRef.current = false;
    await audioContext.resume();
  
    masterGainRef.current.disconnect();
  
    if (!destRef.current) {
      const dest = audioContext.createMediaStreamDestination();
      destRef.current = dest;
  
      const a = new Audio();
      a.muted = true;
      a.srcObject = dest.stream;
      audioElRef.current = a;
    }
  
    const src = audioContext.createBufferSource();
    src.buffer = bufRef.current;
    src.loop = false;
  
    src.onended = () => {
      if (loop && !stoppedRef.current) {
        setCurrentTime(0); // reset progress bar
        playSample(true);  // loop with reset
      } else {
        stopSample();
      }
    };
  
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
    setCurrentTime(0); // reset UI
    setRunning(true);
  
    src.start();
    audioElRef.current?.play().catch(() => {});
  
    requestAnimationFrame(updateProgress);
  }
  

  function stopSample() {
    stoppedRef.current = true;
    srcRef.current?.stop();
    setRunning(false);
    setCurrentTime(0);
  }

  // Slider callbacks
  const handleSlidersReady = useCallback((meta) => {
    setSliderMeta(meta);
    setSliderVals(Object.fromEntries(meta.map(m => [m.address, m.init])));
    slidersReadyRef.current = tubeRef;
  }, []);

  const handleSliderDrag = (addr, val) => {
    tubeRef.current?.setParam(addr, val);
    setSliderVals(vals => ({ ...vals, [addr]: val }));
  };



  function handleSeek(timeInSeconds) {
    if (audioContext && srcRef.current) {
      try {
        srcRef.current.stop();
      } catch {}
  
      const newSrc = audioContext.createBufferSource();
      newSrc.buffer = bufRef.current;
      newSrc.loop   = loop;
      newSrc.onended = () => stopSample();
  
      if (bypass) {
        newSrc.connect(masterGainRef.current);
        masterGainRef.current.connect(audioContext.destination);
      } else {
        newSrc
          .connect(tubeNode)
          .connect(preampConvolver)
          .connect(cabinetConvolverRef.current)
          .connect(masterGainRef.current);
        masterGainRef.current.connect(destRef.current);
      }
  
      srcRef.current = newSrc;
      startTimeRef.current = audioContext.currentTime - timeInSeconds;
  
      newSrc.start(0, timeInSeconds);
      setRunning(true);
      requestAnimationFrame(updateProgress);
    }
  }
  useEffect(() => {
    if (!audioContext || analyserRef.current) return;
  
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;
  
    if (cabinetConvolverRef.current && masterGainRef.current) {
      cabinetConvolverRef.current.disconnect();
      cabinetConvolverRef.current.connect(analyser);
      analyser.connect(masterGainRef.current);
    }
  }, [audioContext]);

  return (
    <div className="App-main">
      <main className='main-wrap' style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
     <div className='select'>

        {/* <h2>🎸 Sample → TubeAmp + Cabinet → Master Out</h2> */}

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

      </main>

      {/* 3D scene with knobs */}
      <Scene
        audioContext={audioContext}
        mediaStream={destRef.current?.stream}
        sliders={sliderMeta}
        values={sliderVals}
        onDragSlider={handleSliderDrag}
      />      
        <div style={{ marginTop: '1rem', }} className='trackviz'>
        {/* <Waveform buffer={bufRef.current} currentTime={currentTime} />
    <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
      {new Date(currentTime * 1000).toISOString().substr(14, 5)} /
      {new Date(duration    * 1000).toISOString().substr(14, 5)}
    </div> */}
<WaveForm
  buffer={bufRef.current}
  currentTime={currentTime}
  duration={duration}
/>


        </div>
    </div>
  );
}
