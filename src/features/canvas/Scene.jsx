// src/Scene.jsx
import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Backdrop, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import Amp from './Amp';
import { Perf } from 'r3f-perf';
import Surrounding from './Surrounding';

export default function Scene({
  audioContext,
  mediaStream,
  sliders , // NEW: meta from TubeAmp
  values , // NEW: { address → currentValue }
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
        }}
      >
        <Environment
          preset='city'
          backgroundBlurriness={0.5}
          background
          environmentIntensity={0.15}
        />
        <directionalLight
          position={[0, 6, 2]}
          intensity={5}
          lookAt={[0, 0, 0]}
          // scale={5}

          castShadow
          angle={0.3}
          color={'#fff'}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
          shadow-camera-near={0.1}
          shadow-camera-far={150}
        />
        <OrbitControls 
        ref={controlsRef} 
        />
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
        <Perf />
      </Canvas>
    </div>
  );
}

function SoundEmitter({ audioContext, mediaStream, distance, sliders, values,
    onDragSlider, controlsRef }) {
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
  // console.log('[SoundEmitter] got values', Object.values(values));
  // console.log('[Scene] sending sliders to Amp', sliders);
  return (
    <mesh ref={meshRef} position={[0, -1, -1]}>
      
      <Amp 
      sliders={sliders}
            values={values}
            onDragSlider={onDragSlider}
            controlsRef={controlsRef} 
      />
    </mesh>
  );
}
