import React, { useState, useEffect } from 'react'
import TubeAmp  from './features/tubeAmp'
import Cabinet  from './features/cabinet'
import './AmpCab.css'
import { RxCross1 } from 'react-icons/rx'

export default function AmpCab({
  audioContext,
  faustCompiler,
  faustFactory,
  onPluginReady,   // passed from App.jsx
  onCabReady,       // passed from App.jsx
  cabinetConvolver,
  onSlidersReady, onSliderChange,
  tubeRef
}) {
  // const [ampConvolver,   setAmpConvolver]   = useState(null)
  const [cabConvolver,   setCabConvolver]   = useState(null)
  // const [sliderMeta, setSliderMeta] = useState([]);
  // const [sliderVals, setSliderVals] = useState({});
  const [open, setOpen] = useState(false);
  // Called by TubeAmp when its DSP node + preamp convolver are ready
  // const handleAmpReady = ([preampConvolver, faustNode]) => {
  //   // Wire them together internally
  //   faustNode.connect(preampConvolver)
  //   setAmpConvolver(preampConvolver)

  //   // **Forward** the event up to App
  //   if (onPluginReady) onPluginReady([preampConvolver, faustNode])
  // }

  const handleAmpReady = ([preampConv, faustNode]) => {
    faustNode.connect(preampConv);
    onPluginReady([preampConv, faustNode]);
  };

  // Called by Cabinet when its IR convolver is ready
  const handleCabReady = convolverNode => {
    setCabConvolver(convolverNode)

    // **Forward** the event up to App
    if (onCabReady) onCabReady(convolverNode)
  }


  return (
    <div className="AmpCab">
      {/* <h1>Tube Amp + Cabinet Demo</h1> */}
      <TubeAmp
      ref={tubeRef}
        id="demo-amp"
        context={audioContext}
        compiler={faustCompiler}
        factory={faustFactory}
        onPluginReady={handleAmpReady}
        onSlidersReady={onSlidersReady}
        // onSliderChange={onSliderChange}
      />

<button
  onClick={() => setOpen(!open)}
  className={`ir-button ${open ? 'open' : ''}`}
>
  {open ?         <RxCross1 color='black' /> : 'IR'}
</button>

<div className={`ir-panel ${open ? 'open' : 'closed'}`}>
  
    <Cabinet
      audioContext={audioContext}
      convolver={cabinetConvolver}
    />

</div>
    </div>
  )
}
