import React, { useRef } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
export function Amp(props) {
  const { nodes, materials } = useGLTF('/amptestOPT.glb');

  const [
    ampCol,
    AmpNorm,
    AmpRough,
    AmpBump,
    PlateCol,
    PlateNorm,
    PlateRough,
    PlateAO,
  ] = useTexture([
    '/Amp_textures/LeatherCol.jpg',
    '/Amp_textures/LeatherNorm.jpg',
    '/Amp_textures/LeatherRough.jpg',
    '/Amp_textures/LeatherHeight.jpg',
    '/Amp_textures/Plate_Grid2_Diff.png',
    '/Amp_textures/Plate_Grid_Norm.png',
    '/Amp_textures/Plate_Grid2_Rough.png',
    '/Amp_textures/Plate_Grid2_AO.png',
  ]);

  const textures = [ampCol, AmpNorm, AmpRough];
  textures.forEach((tex) => {
    tex.flipY = false;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.offset.set(0, 0);
    tex.repeat.set(15, 15);
  });

  PlateCol.flipY = PlateNorm.flipY = PlateRough.flipY = PlateAO.flipY =  false;
  const ampMat = new THREE.MeshStandardMaterial({
    normalMap: AmpNorm,
    roughnessMap: AmpRough,
    normalMapType: THREE.TangentSpaceNormalMap,
    bumpMap: AmpBump,
  });

  const plateGridMat = new THREE.MeshStandardMaterial({
    map: PlateCol,
    normalMap: PlateNorm,
    roughnessMap: PlateRough,
    emissive: '#aaa',
    emissiveMap: PlateCol,
    emissiveIntensity: 0.5,
    roughness: .5,
    // metalnessMap: PlateRough,
    metalness: 1,
    aoMap: PlateAO
  });
  const gridCurveMat = new THREE.MeshStandardMaterial({
    color: '#51D6E7',
    roughness: 0.5,
  });


  const blackPlastic = new THREE.MeshStandardMaterial({color: "#222", roughness: .5})
  const metalMat = new THREE.MeshStandardMaterial({metalness: 1, roughness: .1})
  return (
    <group {...props} dispose={null}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Jack_wire.geometry}
        material={blackPlastic}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Grid_Curve.geometry}
        material={gridCurveMat}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Backplate.geometry}
        material={nodes.Backplate.material}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Feet.geometry}
        material={blackPlastic}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Jack_input.geometry}
        material={metalMat}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Jack_plug.geometry}
        material={metalMat}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Amp_case001.geometry}
        material={ampMat}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plate_Grid.geometry}
        material={plateGridMat}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Cylinder001.geometry}
        material={nodes.Cylinder001.material}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Cylinder001_1.geometry}
        material={nodes.Cylinder001_1.material}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Cylinder001_2.geometry}
        material={nodes.Cylinder001_2.material}
      />
    </group>
  );
}

useGLTF.preload('/amptestOPT.glb');
