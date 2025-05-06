// src/features/amp/Amp.jsx
import React, { useRef, useState } from 'react';
import { useGLTF, useTexture, useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useDrag } from '@use-gesture/react';
import * as THREE from 'three';

/* ─────────────────────────────  CONFIG  ─────────────────────────────── */
const ROT_AXIS  = 'y';   // change to 'y' if your knobs rotate on Y
const FULL_PIX  = 150;   // vertical pixels for min → max range
const SPACING   = 0.83;  // metres between knobs
const START_Y   = 0.11;  // knob row Y
const START_Z   = 0.06;  // knob row Z
const ANGLE_MIN = -140;
const ANGLE_MAX =  140;
/* ────────────────────────────────────────────────────────────────────── */

export default function Amp({
  sliders = [],
  values  = {},
  onDragSlider = () => {},
  controlsRef,              // OrbitControls ref passed from Scene
  ...props                  // position / rotation / scale etc.
}) {
  /* -------- GLTF + materials (unchanged) ----------------------------- */
  const { nodes } = useGLTF('/amptestOPT.glb');

  const [
    ampCol, AmpNorm, AmpRough, AmpBump,
    PlateCol, PlateNorm, PlateRough, PlateAO
  ] = useTexture([
    '/Amp_textures/LeatherCol.jpg',
    '/Amp_textures/LeatherNorm.jpg',
    '/Amp_textures/LeatherRough.jpg',
    '/Amp_textures/LeatherHeight.jpg',
    '/Amp_textures/Plate_Grid2_Diff.png',
    '/Amp_textures/Plate_Grid_Norm.png',
    '/Amp_textures/Plate_Grid2_Rough.png',
    '/Amp_textures/Plate_Grid2_AO.png'
  ]);

  [ampCol, AmpNorm, AmpRough].forEach(t => {
    t.flipY = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(15, 15);
  });
  PlateCol.flipY = PlateNorm.flipY = PlateRough.flipY = PlateAO.flipY = false;

  const ampMat = new THREE.MeshStandardMaterial({
    normalMap: AmpNorm,
    roughnessMap: AmpRough,
    normalMapType: THREE.TangentSpaceNormalMap,
    bumpMap: AmpBump
  });
  const plateGridMat = new THREE.MeshStandardMaterial({
    map: PlateCol,
    normalMap: PlateNorm,
    roughnessMap: PlateRough,
    emissive: '#aaa',
    emissiveMap: PlateCol,
    emissiveIntensity: 0.5,
    roughness: 0.5,
    metalness: 1,
    aoMap: PlateAO
  });
  const gridCurveMat = new THREE.MeshStandardMaterial({ color: '#51D6E7', roughness: 0.5 });
  const blackPlastic = new THREE.MeshStandardMaterial({ color: '#222',  roughness: 0.5 });
  const metalMat     = new THREE.MeshStandardMaterial({ metalness: 1,   roughness: 0.1 });

  /* -------- helpers --------------------------------------------------- */
  const deg = THREE.MathUtils.degToRad;
  const toAngle = (val, { min, max }) =>
    THREE.MathUtils.lerp(deg(ANGLE_MIN), deg(ANGLE_MAX), (val - min) / (max - min));

  /* -------- refs & local state ---------------------------------------- */
  const knobRefs   = useRef([]);
  const draggingIx = useRef(null);      // index of currently dragged knob

  /* -------- animate every frame from parent values, UNLESS dragging --- */
  useFrame(() =>
    sliders.forEach((s, i) => {
      if (draggingIx.current === i) return;      // don’t overwrite live drag
      // console.log('render', s.label, values[s.address]); 
      
      const g = knobRefs.current[i];
      if (g) g.rotation[ROT_AXIS] = toAngle(values[s.address] ?? s.init, s);
    })
  );

  /* -------- drag gesture ---------------------------------------------- */
  const dragBind = useDrag(
    ({ args: [idx], movement: [, dy], memo, first, last }) => {
      const d = sliders[idx];
      if (!d) return memo;
  
      /* lock / unlock OrbitControls */
      if (first) {
        draggingIx.current = idx;
        controlsRef?.current && (controlsRef.current.enabled = false);
      }
      if (last) {
        draggingIx.current = null;
        controlsRef?.current && (controlsRef.current.enabled = true);

       return memo;                 // 🔸 early exit, keep memo
      }
  
      /* value maths (runs only while dragging, not after) */
      const start = memo ?? (values[d.address] ?? d.init);
      const delta = -dy / FULL_PIX * (d.max - d.min);
      const next  = THREE.MathUtils.clamp(start + delta, d.min, d.max);
  
      /* immediate local rotation */
      knobRefs.current[idx].rotation[ROT_AXIS] = toAngle(next, d);
  
      onDragSlider(d.address, next);            // 🔹 push NEW value
      return start;
    },
    {
      axis: 'y',
      pointerEvents: true,
      stopPropagation: true,
      from: state => {
        const idx = state.args[0];
        const d   = sliders[idx];
        if (!d) return [0, 0];
        const v   = values[d.address] ?? d.init;
        const pct = (v - d.min) / (d.max - d.min);
        return [0, -pct * FULL_PIX];
      }
    }
  );

  /* -------- cursor feedback & orbit lock on hover --------------------- */
  const [hover, setHover] = useState(false);
  useCursor(hover, 'grab');

  const handleOver = () => {
    setHover(true);
    controlsRef?.current && (controlsRef.current.enabled = false);
  };
  const handleOut = () => {
    setHover(false);
    controlsRef?.current && (controlsRef.current.enabled = true);
  };

  /* -------- layout ---------------------------------------------------- */
  const startX = -(sliders.length - 1) * SPACING * 0.5;

  /* -------- render ---------------------------------------------------- */
  return (
    <group {...props} dispose={null}>
      {/* static parts */}
      {/* <mesh geometry={nodes.Jack_wire.geometry}   material={blackPlastic} castShadow receiveShadow />
      <mesh geometry={nodes.Grid_Curve.geometry}  material={gridCurveMat} castShadow receiveShadow />
      <mesh geometry={nodes.Backplate.geometry}   material={nodes.Backplate.material} castShadow receiveShadow />
      <mesh geometry={nodes.Feet.geometry}        material={blackPlastic} castShadow receiveShadow />
      <mesh geometry={nodes.Jack_input.geometry}  material={metalMat} castShadow receiveShadow />
      <mesh geometry={nodes.Jack_plug.geometry}   material={metalMat} castShadow receiveShadow />
      <mesh geometry={nodes.Amp_case001.geometry} material={ampMat} castShadow receiveShadow />
      <mesh geometry={nodes.Plate_Grid.geometry}  material={plateGridMat} castShadow receiveShadow /> */}

      {/* knobs */}
      {sliders.map((s, i) => (
        <group
          key={s.address}
          position={[startX + i * SPACING, START_Y, START_Z]}
          ref={g => (knobRefs.current[i] = g)}
          {...dragBind(i)}
          onPointerOver={handleOver}
          onPointerOut={handleOut}
        >
          <mesh geometry={nodes.Cylinder001.geometry}   material={blackPlastic} castShadow receiveShadow />
          <mesh geometry={nodes.Cylinder001_1.geometry} material={metalMat}     castShadow receiveShadow />
          <mesh geometry={nodes.Cylinder001_2.geometry} material={nodes.Cylinder001_2.material} castShadow receiveShadow />
        </group>
      ))}
    </group>
  );
}

useGLTF.preload('/amptestOPT.glb');
