// src/features/amp/Amp.jsx   ⟨static chassis – no knobs, no state⟩
import React, { useMemo } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';

/* texture files ------------------------------------------------------- */
const TEX = [
  '/Amp_textures/LeatherCol.jpg',
  '/Amp_textures/LeatherNorm.jpg',
  '/Amp_textures/LeatherRough.jpg',
  '/Amp_textures/LeatherHeight.jpg',
  '/Amp_textures/Plate_Grid3_Pass 5.png',
  '/Amp_textures/Plate_Grid3_Norm.png',
  '/Amp_textures/Plate_Grid2_Rough.png',
  '/Amp_textures/Plate_Grid2_Metal.png',
  '/Amp_textures/Plate_Grid3_AO.png'
];

/* static chassis component ------------------------------------------- */
export default function AmpShell(props) {
  const { nodes } = useGLTF('/amptestOPT.glb');
  const [
    ampCol, ampNorm, ampRough, ampBump,
    plateCol, plateNorm, plateRough,plateMetal, plateAO
  ] = useTexture(TEX);

  /* repeat settings for leather */
  [ampCol, ampNorm, ampRough].forEach(t => {
    t.flipY = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(15, 15);
  });
  plateCol.flipY =
    plateNorm.flipY =
    plateRough.flipY =
    plateMetal.flipY =
    plateAO.flipY = false;

  /* materials -------------------------------------------------------- */
  const ampMat = useMemo(() =>new THREE.MeshStandardMaterial({
    normalMap: ampNorm,
    roughnessMap: ampRough,
    bumpMap: ampBump,
    normalMapType: THREE.TangentSpaceNormalMap,
    // side: THREE.DoubleSide
  
  }), []);

  const plateGridMat = useMemo(() =>new THREE.MeshPhysicalMaterial({
    map:          plateCol,
    toneMapped: THREE.NoToneMapping,
    // normalMap:    plateNorm,
    normalScale : new THREE.Vector2(.5,.5),
    // roughnessMap: plateRough,
    // anisotropy: .5,
  clearcoatNormalMap : plateNorm,
  clearcoat : .41,
  clearcoatRoughnessMap : plateRough,
    // aoMap:        plateAO,
    // aoMapIntensity: 1,
    // emissive:     '#aaa',
    // emissiveMap:  plateCol,
    // emissiveIntensity: 0.5,
    roughness: 0.15,
    // metalness: .8,
    // metalnessMap: plateMetal,
   
  }), []);

  const gridCurveMat = useMemo(() =>new THREE.MeshStandardMaterial({ color: '#51D6E7', roughness: 0.5 }), []);
  const blackPlastic = useMemo(() =>new THREE.MeshStandardMaterial({ color: '#222',    roughness: 0.5 }), []);
  const metalMat     = useMemo(() =>new THREE.MeshStandardMaterial({ metalness: 1,     roughness: 0.1, envMapIntensity: 2.5, }), []);

  /* render ----------------------------------------------------------- */
  return (
    <group {...props} dispose={null}>
      <mesh geometry={nodes.Jack_wire.geometry}   material={blackPlastic} castShadow receiveShadow />
      <mesh geometry={nodes.Grid_Curve.geometry}  material={gridCurveMat} castShadow receiveShadow />
      <mesh geometry={nodes.Backplate.geometry}   material={nodes.Backplate.material} castShadow receiveShadow />
      <mesh geometry={nodes.Feet.geometry}        material={blackPlastic} castShadow receiveShadow />
      <mesh geometry={nodes.Jack_input.geometry}  material={metalMat}     castShadow receiveShadow />
      <mesh geometry={nodes.Jack_plug.geometry}   material={metalMat}     castShadow receiveShadow />
      <mesh geometry={nodes.Amp_case001.geometry} material={ampMat}       castShadow receiveShadow />
      <mesh geometry={nodes.Plate_Grid.geometry}  material={plateGridMat} castShadow receiveShadow />
   
    </group>
  );
}

useGLTF.preload('/amptestOPT.glb');
