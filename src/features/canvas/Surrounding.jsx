import React from 'react'
import * as THREE from 'three'

function Surrounding() {
  return (
    <>
    <fog attach="fog" args={[ "#ddd", 10, 20]} />
   <mesh rotation={[-Math.PI*0.5,0,0]} position={[0,-3.17,0]} receiveShadow >
    <circleGeometry args={[52,40]}/>
    <meshStandardMaterial color={"#ddd"} side={THREE.DoubleSide} shadowSide={THREE.FrontSide}/>
   </mesh>
   <mesh position={[0,20,0]}>
    <cylinderGeometry args={[40,40,52,52, 32,false, 2.11,8.11]}
    
    />
    <meshBasicMaterial color={"#ddd"} side={THREE.DoubleSide}/>
   </mesh>
    </>
  )
}

export default Surrounding