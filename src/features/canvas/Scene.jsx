// src/Scene.jsx
import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Backdrop, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Perf } from 'r3f-perf';
import Surrounding from './Surrounding';
import AmpShell from './Amp';
import Knob from './Knob';

export default function Scene({
  audioContext,
  mediaStream,
  sliders, // NEW: meta from TubeAmp
  values, // NEW: { address → currentValue }
  onDragSlider = () => {},
  ...props
}) {
  const controlsRef = useRef();

  return (
    <div className='canvas-main' style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ fov: 80 }}
        shadows
        dpr={[1, 2]}
        gl={{
          // preserveDrawingBuffer: true,
          antialias: true,
          alpha: true,

          // powerPreference: 'high-performance',
          physicallyCorrectLights: true,
          outputEncoding: THREE.sRGBEncoding,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
        }}
        // legacy
      >

        <Environment
          preset='city'
          // backgroundBlurriness={0.5}
          // background
          environmentIntensity={0.25}
        />
  
        <directionalLight
          castShadow
          intensity={1.4}                 // lux
          position={[0, 6, 2]}
          shadow-mapSize={[2048, 2048]}    // crisper penumbra
          // shadow-bias={-0.000005} 
          color={"#fdf3e6"}
        >
          <orthographicCamera
            attach='shadow-camera'
            args={[-15, 15, 15, -15]}
          />
        </directionalLight>
      

        <OrbitControls ref={controlsRef} />
        <SoundEmitter
          audioContext={audioContext}
          mediaStream={mediaStream}
          distance={5}
          sliders={sliders}
          values={values} // NEW
          onDragSlider={onDragSlider}
          controlsRef={controlsRef}
        />
        <Surrounding />
        {/* <Perf 
        deepAnalyze
        /> */}
      </Canvas>
    </div>
  );
}

function SoundEmitter({
  audioContext,
  mediaStream,
  distance,
  sliders,
  values,
  onDragSlider,
  controlsRef,
}) {
  const meshRef = useRef();
  const { camera } = useThree();

  useEffect(() => {
    if (!audioContext || !mediaStream || !meshRef.current) return;

    // 1) Create & configure the listener to use *your* AudioContext
    const listener = new THREE.AudioListener();
    // OVERRIDE the default context:
    listener.context = audioContext;
    // Replace its gain node so it also lives in your context:
    listener.gain = audioContext.createGain();
    listener.gain.connect(audioContext.destination);

    camera.add(listener);

    // 2) Create PositionalAudio with our listener
    const positional = new THREE.PositionalAudio(listener);
    meshRef.current.add(positional);

    // 3) Convert MediaStream → AudioNode in your context
    const sourceNode = audioContext.createMediaStreamSource(mediaStream);

    // 4) Hook it up
    positional.setNodeSource(sourceNode);
    positional.setRefDistance(distance);
    positional.setLoop(true);
    // positional.play();

    return () => {
      positional.stop();
      camera.remove(listener);
    };
  }, [audioContext, mediaStream, camera, distance]);

  const spacing = 1.1;
  const startX = -(sliders.length - 1) * 1 * 0.5;

  const { invalidate, advance } = useThree();

// Stop automatic rendering
useEffect(() => {
  invalidate(); // stop RAF
}, []);
  return (
    <mesh ref={meshRef} position={[0, -1, -1]}>
      <AmpShell
        sliders={sliders}
        values={values}
        onDragSlider={onDragSlider}
        controlsRef={controlsRef}
      />
      {sliders.map((d, i) => (
        <Knob
          key={d.address}
          desc={d}
          value={values[d.address] ?? d.init}
          onChange={onDragSlider}
          controlsRef={controlsRef}
          position={[startX + i * spacing, 1.223, 1.584]}
        />
      ))}
    </mesh>
  );
}
