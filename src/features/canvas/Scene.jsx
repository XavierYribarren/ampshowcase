// src/Scene.jsx
import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Backdrop, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Amp } from './Amp';
import { Perf } from 'r3f-perf';

export default function Scene({ audioContext, mediaStream }) {
  return (
    <div className="canvas-main" style={{ width: '100%', height: '100%' }}>
      <Canvas>
        <Environment preset="city" backgroundBlurriness={.5} background />
        <OrbitControls />
        <SoundEmitter
          audioContext={audioContext}
          mediaStream={mediaStream}
          distance={5}
        />

        <Perf/>
      </Canvas>
    </div>
  );
}

function SoundEmitter({ audioContext, mediaStream, distance }) {
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
    positional.play();

    return () => {
      positional.stop();
      camera.remove(listener);
    };
  }, [audioContext, mediaStream, camera, distance]);

  return (
    <mesh ref={meshRef} position={[0, -1, -1]}>
<Amp/>
    </mesh>
  );
}
