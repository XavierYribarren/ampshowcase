// src/features/amp/Knob.jsx
import React, { useRef, useLayoutEffect, useState } from 'react';
import { useGLTF, useCursor, useTexture, Text } from '@react-three/drei';
import { useDrag } from '@use-gesture/react';
import * as THREE from 'three';

/* rotary behaviour --------------------------------------------------- */
const FULL_PIX = 150;        // vertical pixels for full range
const DEG_MIN  = -135;       // hard‑left stop
const DEG_MAX  =  135;       // hard‑right stop
const PRE_TILT = Math.PI / 3; // knob in GLB is ~45° up on X

export default function Knob({
  desc,                       // { address,min,max,init }
  value,                      // current numeric value
  onChange     = () => {},    // (address,val)
  controlsRef,                // OrbitControls ref
  tilt = PRE_TILT,            // override if your GLB differs
  ...props                    // position / scale etc.
}) {
  /* geometry ---------------------------------------------------------- */
  const { nodes } = useGLTF('/knobonly.glb');

const [knobComb, knobRough] = useTexture([

  '/Amp_textures/Knob_Pass 1.png',
'/Amp_textures/Knob_Pass 2.png',
])

  /* helpers ----------------------------------------------------------- */
  const toAngle = v =>
    THREE.MathUtils.lerp(
      THREE.MathUtils.degToRad(DEG_MIN),
      THREE.MathUtils.degToRad(DEG_MAX),
      (v - desc.min) / (desc.max - desc.min)
    );

  /* refs -------------------------------------------------------------- */
  const rotorRef = useRef();          // spins around local Y

  /* sync rotor to incoming *value* prop ------------------------------- */
  useLayoutEffect(() => {
    rotorRef.current.rotation.set(0, toAngle(value), 0);
  }, [value]);

  /* gesture ----------------------------------------------------------- */
  const bind = useDrag(
    ({ movement: [dx, dy], memo, first, last }) => {
      if (first) controlsRef?.current && (controlsRef.current.enabled = false);
      if (last)  controlsRef?.current && (controlsRef.current.enabled = true);

      const start = memo ?? value;
  //  combine vertical (‑dy) and horizontal (+dx) movement
  //      up    (‑dy)  → clockwise  (+)
  //      right (+dx)  → clockwise  (+)
  //      down  (+dy)  → counter‑cw (‑)
  //      left  (‑dx)  → counter‑cw (‑)                           */
    const deltaPix = -dy + dx;        // pixels driving the knob
    const range    = desc.max - desc.min;
    const next     = THREE.MathUtils.clamp(
      start + (deltaPix / FULL_PIX) * range,
      desc.min,
      desc.max
    );

      rotorRef.current.rotation.set(0, toAngle(-next), 0);  // X=Z=0 clamp
      onChange(desc.address, next);
      return start;
    },
    {
      axis: 'y',
      pointerEvents: true,
      stopPropagation: true,
      from: () => [0, -(value - desc.min) / (desc.max - desc.min) * FULL_PIX]
    }
  );

  /* cursor & orbit lock on hover ------------------------------------- */
  const [hover, setHover] = useState(false);
  useCursor(hover, 'grab');

  const toggleOrbit = locked =>
    controlsRef?.current && (controlsRef.current.enabled = !locked);
  knobComb.flipY = knobRough.flipY = false

  const blackPlastic = new THREE.MeshStandardMaterial({ color: '#222',    roughness: 0.5, roughnessMap: knobRough });
  const metalMat     = new THREE.MeshStandardMaterial({ metalness: 1,     roughness: 0.1 });

//  console.log(desc)
  return (
    <group
      {...props}
      {...bind()}
      onPointerOver={() => { setHover(true);  toggleOrbit(true);  }}
      onPointerOut ={() => { setHover(false); toggleOrbit(false); }}
      dispose={null}
    >
      {/* static counter‑tilt around X */}
      <group rotation={[tilt, 0, 0]}>
        {/* rotor spins around *its* local Y */}
        <group ref={rotorRef}>
          <mesh geometry={nodes.Cylinder001.geometry}   material={blackPlastic} castShadow receiveShadow/>
          <mesh geometry={nodes.Cylinder001_1.geometry} material={metalMat} castShadow receiveShadow/>
          <mesh geometry={nodes.Cylinder001_2.geometry} material={nodes.Cylinder001_2.material} castShadow receiveShadow/>
        </group>
        </group>
      <Text 
      position={[0,-.3,.21]}
      // rotation={[tilt, 0, 0]}
      scale={.15}
      >
        {desc.label}
      </Text>
    </group>
  );
}

useGLTF.preload('/knobonly.glb');
