import React, { useState } from 'react';
import './Credits.css';
import { MdOutlineInfo } from 'react-icons/md';
import { RxCross1, RxLinkedinLogo } from 'react-icons/rx';
import { ImGithub } from 'react-icons/im';
import { TfiWorld } from 'react-icons/tfi';

function Credits() {
  const [open, setOpen] = useState(false);

  const togglePanel = () => {
    setOpen(!open);
  };

  return (
    <>
      <button className='toggle-button' onClick={togglePanel}>
        {open ? '✕' : <MdOutlineInfo size={24} />}
      </button>

      <div className={`side-panel ${open ? 'open' : ''}`}>
        <button className='close-button' onClick={togglePanel}>
          <RxCross1 />
        </button>
        <div className='panel-content'>
          <div className='credits-title'>
            <h2>Credits</h2>

            <p className='credits-subtitle'>
              <span className='credits-webamp'>WebAmp</span> by{' '}
              <span className='credits-barren'>
                {' '}
                <a href='http://barren.fr'>BarrenXY</a>
              </span>{' '}
            </p>
          </div>

          <div className='credits-content'>
            <p>
              This is an experiment about bringing VST plugins technology to the
              web for products showcasing . My first time trying to figure out
              some c++ and Emscripten!
            </p>

            <p>
              All 3D assets are made by me, the materials are from BlenderKit
              and tweaked as needed.
            </p>
            <p>
              DSP files for sound processing are made by{' '}
              <a href='https://github.com/olegkapitonov/Kapitonov-Plugins-Pack'>
                Oleg Kapitonov
              </a>{' '}
            </p>
          </div>
          <div className='links'>
            <a href='https://www.linkedin.com/in/xavier-yribarren/'>
              <RxLinkedinLogo size={48} />
            </a>
            <a href='https://github.com/XavierYribarren'>
              <ImGithub size={48} />
            </a>
            <a href='http://barren.fr'>
              <TfiWorld size={48} />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export default Credits;
