// src/features/cabinet/Cabinet.jsx
import React, { useState, useEffect } from 'react';
import './Cabinet.css';

const positions = ['center','cone','edge'];
const irs       = ['1on-preshigh','1on-pres8','1on-pres5'];

export default function Cabinet({ audioContext, convolver }) {
  const [position, setPosition] = useState(0);

  // cycle positions
  const changePosition = () =>
    setPosition(p => (p+1)%positions.length);

  // file-upload handler
  const onIRInput = e => {
    if (audioContext && e.target.files?.length) {
      e.target.files[0].arrayBuffer()
        .then(buf => audioContext.decodeAudioData(buf, decoded => {
          convolver.buffer = decoded;
        }))
        .catch(console.error);
    }
  };

  // on position change, fetch the new IR and swap buffer
  useEffect(() => {
    if (!audioContext) return;
    const name = irs[position] + '.wav';
    fetch(`/ir/${name}`)
      .then(res => res.arrayBuffer())
      .then(buf => audioContext.decodeAudioData(buf, decoded => {
        convolver.buffer = decoded;
      }))
      .catch(err => console.error('IR load error:', err));
  }, [position, audioContext, convolver]);

  return (
    <>
      <div className="cabinet" onClick={changePosition}>
        <img className="speaker" src="/speaker.png" alt="Speaker"/>
        <img className={`mic mic--${positions[position]}`}
             src="/shure_sm57.png" alt="Mic" />
      </div>
      <div className="ir-input">
        <label htmlFor="ir">Choose your IR</label>
        <input type="file" id="ir" accept="audio/*"
               onChange={onIRInput} />
      </div>
    </>
  );
}
