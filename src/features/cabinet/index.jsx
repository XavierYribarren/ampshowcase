import React, { useState, useEffect } from 'react';
import './Cabinet.css';

const positions = ['center', 'cone', 'edge'];
const irs = ['1on-preshigh', '1on-pres8', '1on-pres5'];

const cabConvolverFromArrayBuffer = (ctx, buffer, cb) => {
  const c = new ConvolverNode(ctx);
  ctx.decodeAudioData(buffer, decoded => {
    c.buffer = decoded;
    if (cb) cb(c);
  });
};

export default function Cabinet({ audioContext, onCabReady }) {
  const [position, setPosition] = useState(0);

  const changePosition = () => {
    setPosition(prev =>
      prev === positions.length - 1 ? 0 : prev + 1
    );
  };

  const onIRInput = event => {
    if (audioContext && event.target.files?.length) {
      event.target.files[0]
        .arrayBuffer()
        .then(buffer =>
          cabConvolverFromArrayBuffer(audioContext, buffer, onCabReady)
        )
        .catch(err => console.error('IR file load error:', err));
    }
  };
  const url = `${import.meta.env.BASE_URL}ir/${irs[position]}.wav`;
  // console.log(url)

  useEffect(() => {
    if (!audioContext) return;

    fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then(buffer =>
        cabConvolverFromArrayBuffer(audioContext, buffer, onCabReady)
      )
      .catch(err => console.error('Cabinet IR load error:', err));
  }, [url, audioContext, onCabReady]);

  return (
    <>
      <div className="cabinet" onClick={changePosition}>
        <img
          className="speaker"
          alt="Guitar Speaker"
          src={`${import.meta.env.BASE_URL}speaker.png`}
        />
        <img
          className={`mic mic--${positions[position]}`}
          alt="Microphone"
          src={`${import.meta.env.BASE_URL}shure_sm57.png`}
        />
      </div>
      <div className="ir-input">
        <label htmlFor="ir">Choose your IR</label>
        <input type="file" id="ir" accept="audio/*" onChange={onIRInput} />
      </div>
    </>
  );
}
