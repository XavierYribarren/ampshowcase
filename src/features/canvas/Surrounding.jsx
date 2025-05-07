import { Text } from '@react-three/drei';
import React from 'react';
import * as THREE from 'three';

function Surrounding() {
  return (
    <>
      <fog attach='fog' args={['#ddd', 20, 30]} />
      <mesh
        rotation={[-Math.PI * 0.5, 0, 0]}
        position={[0, -3.17, 0]}
        receiveShadow
      >
        <circleGeometry args={[62, 40]} />
        <meshStandardMaterial
          color={'#ddd'}
          side={THREE.DoubleSide}
          shadowSide={THREE.FrontSide}
        />
      </mesh>
      <mesh position={[0, 20, 0]}>
        <cylinderGeometry args={[50, 50, 52, 52, 32, false, 2.11, 8.11]} />
        <meshBasicMaterial color={'#ddd'} side={THREE.DoubleSide} />
      </mesh>
      <Text scale={12} position={[0, 6, -10]} color={"#eee"} outlineColor={"#fff"} outlineWidth={.01}>
        WEBAMP
      </Text>
    </>
  );
}

export default Surrounding;
