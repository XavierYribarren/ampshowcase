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
import './App.scss';
import Scene from './features/canvas/Scene';

import WaveForm from './features/controls/WaveForm';
import { MdFindReplace, MdOutlineInfo, MdPlayArrow, MdStop } from "react-icons/md";
import { RxLoop } from "react-icons/rx";
import Credits from './features/details/Credits';

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
  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file || !audioContext) return;
    const arrayBuffer = await file.arrayBuffer();
    audioContext.decodeAudioData(arrayBuffer, buffer => {
      bufRef.current = buffer;
      setDuration(buffer.duration);
      setAudioFile(file);
      setLoaded(true);
    }, err => console.error("decodeAudioData failed:", err));
  }
  return (
    <div className="App-main">
      <main className='main-wrap' style={{ fontFamily: 'sans-serif' }}>
     <div className='select'>

        {/* <h2>🎸 Sample → TubeAmp + Cabinet → Master Out</h2> */}

        <div className='file-play-stop'>
       <div className='file-wrap'>

        <input type="file" accept="audio/*" id="audioFileInput" onChange={handleFile} className="hidden" />
       </div>
            <label htmlFor="audioFileInput" className="file-input-label"><MdFindReplace size={24}/> Select Audio File</label>
            {audioFile && <span className="file-name">{audioFile.name}</span>}
       <div className="buttons-wrap">

       <button onClick={playSample} disabled={!loaded || running} className={`play ${running ? 'active' : ''}`}>
       <MdPlayArrow size={24}/> 
          </button>
          <button onClick={stopSample} disabled={!running}><MdStop size={24}/></button>

    
        <button
      className={`loop-toggle ${loop ? 'active' : ''}`}
      onClick={() => setLoop(prev => !prev)}
    >
      <RxLoop size={24}/>

    </button>
       </div>
 
        </div>

        <div style={{  display: 'flex', flexDirection: 'column'
         }}
       
         >
          <span   className='label'>

          {/* <label> */}
            Master:&nbsp;
          </span>
           <div>
            <input
              type="range" min="0" max="10" step="0.01"
              value={gain}
              onChange={e => setGain(parseFloat(e.target.value))}
              className='range-style'
              /> 
              {/* {gain.toFixed(2)} */}
              </div>
          {/* </label> */}
        </div>

      
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
      <Credits/>
    
        <div style={{ marginTop: '1rem', }} className='trackviz'>

<WaveForm
  buffer={bufRef.current}
  currentTime={currentTime}
  duration={duration}
/>


        </div>
    </div>
  );
}
