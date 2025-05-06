// src/features/amp/Amp.jsx
import React, { useRef, useState } from 'react';
import { useGLTF, useTexture, useCursor } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useDrag } from '@use-gesture/react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// props
//   sliders       : [{ address, label, min, max, init }, …]  (from TubeAmp)
//   values        : { [address]: currentValue }              (kept in AmpCab)
//   onDragSlider  : (address, newValue)  →  forward to TubeAmp.setParam
//   …plus anything else (position, rotation, etc.) via ...props
// ─────────────────────────────────────────────────────────────
export default function Amp({
  sliders = [],
  values  = {},
  onDragSlider = () => {},
  controlsRef,
  ...props
}) {
  const { nodes } = useGLTF('/amptestOPT.glb');
  const { gl } = useThree();               // import { useThree } from '@react-three/fiber'
  // const controls = gl.controls; 
  // ---------- textures & materials (unchanged) ---------------------------
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

  const repeatTex = [ampCol, AmpNorm, AmpRough];
  repeatTex.forEach(t => {
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
  const blackPlastic = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.5 });
  const metalMat     = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.1 });

  // ---------- knob interaction ------------------------------------------
  const knobRefs = useRef([]);
  const toAngle  = (v, { min, max }) =>
    THREE.MathUtils.lerp(
      THREE.MathUtils.degToRad(-140),
      THREE.MathUtils.degToRad( 140),
      (v - min) / (max - min)
    );

  // animate rotation every frame
  useFrame(() =>
    sliders.forEach((s, i) => {
      const g = knobRefs.current[i];
      if (g) g.rotation.z = toAngle(values[s.address] ?? s.init, s);
    })
  );

  // drag → parameter
  const dragBind = useDrag(
    ({ args: [idx], movement: [, dy], memo, first, last }) => {
      if (first && controlsRef?.current) controlsRef.current.enabled = false;   // disable orbit
      if (last  && controlsRef?.current) controlsRef.current.enabled = true;    // re‑enable
  
      const desc = sliders[idx];
      if (!desc) return memo;
      const start = memo ?? (values[desc.address] ?? desc.init);
      const delta = -dy / 150 * (desc.max - desc.min);   // 150 px ≈ full throw
      const next  = THREE.MathUtils.clamp(start + delta, desc.min, desc.max);
      onDragSlider(desc.address, next);
      return start;                                      // memo for next drag event
    },
    { axis: 'y', pointerEvents: true }
  );

  // cursor feedback
  const [hover, setHover] = useState(false);
  useCursor(hover, 'grab');
  const handleOver  = () => {
    setHover(true);
    controlsRef?.current && (controlsRef.current.enabled = false);
  };
  const handleOut = () => {
    setHover(false);
    controlsRef?.current && (controlsRef.current.enabled = true);
  };
  // simple horizontal layout under grille
  const spacing = 0.13;
  const startX  = -(sliders.length - 1) * spacing * 0.5;
  const knobY   = 0.11;
  const knobZ   = 0.06;


  // console.log('controlsRef?', !!controlsRef?.current);

  // ---------- actual model ----------------------------------------------
  return (
    <group {...props} dispose={null}>
      {/* static meshes */}
      <mesh geometry={nodes.Jack_wire.geometry}   material={blackPlastic} castShadow receiveShadow />
      <mesh geometry={nodes.Grid_Curve.geometry}  material={gridCurveMat} castShadow receiveShadow />
      <mesh geometry={nodes.Backplate.geometry}   material={nodes.Backplate.material} castShadow receiveShadow />
      <mesh geometry={nodes.Feet.geometry}        material={blackPlastic} castShadow receiveShadow />
      <mesh geometry={nodes.Jack_input.geometry}  material={metalMat} castShadow receiveShadow />
      <mesh geometry={nodes.Jack_plug.geometry}   material={metalMat} castShadow receiveShadow />
      <mesh geometry={nodes.Amp_case001.geometry} material={ampMat} castShadow receiveShadow />
      <mesh geometry={nodes.Plate_Grid.geometry}  material={plateGridMat} castShadow receiveShadow />

      {/* duplicated knobs */}
      {sliders.map((s, i) => (
        <group
          key={s.address}
          position={[startX + i * spacing, knobY, knobZ]}
          ref={g => (knobRefs.current[i] = g)}
          {...dragBind(i)}
          // onPointerOver={() => setHover(true)}
          // onPointerOut ={() => setHover(false)}
          onPointerOver={handleOver}
          onPointerOut ={handleOut}
          onPointerDown={e => e.stopPropagation()}
        >
          <mesh
            geometry={nodes.Cylinder001.geometry}
            material={blackPlastic}
            castShadow receiveShadow
          />
          <mesh
            geometry={nodes.Cylinder001_1.geometry}
            material={metalMat}
            castShadow receiveShadow
          />
          <mesh
            geometry={nodes.Cylinder001_2.geometry}
            material={nodes.Cylinder001_2.material}
            castShadow receiveShadow
          />
        </group>
      ))}
    </group>
  );
}

useGLTF.preload('/amptestOPT.glb');
