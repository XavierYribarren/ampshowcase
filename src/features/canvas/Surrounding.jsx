import React from 'react'
import * as THREE from 'three'

function Surrounding() {
  return (
   <mesh rotation={[-Math.PI*0.5,0,0]} position={[0,-3.17,0]} receiveShadow >
    <circleGeometry args={[52,40]}/>
    <meshStandardMaterial color={"#ddd"} side={THREE.DoubleSide} shadowSide={THREE.FrontSide}/>
   </mesh>
  )
}

export default Surrounding