
import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function Knob(props) {
  const { nodes, materials } = useGLTF('/knobonly.glb')
  return (
    <group {...props} dispose={null}>
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
  )
}

useGLTF.preload('/knobonly.glb')
