import React, { useState, useEffect, useRef } from 'react';
import { Knob, Pointer, Arc } from 'rc-knob';
import { resample } from 'wave-resampler';

import {  ProfileProps, profileSize, impulseSize } from './profile';
import { stopEventPropagation } from '../../helpers/utils';

const tubeAmpAddr = 'kpp_tubeamp.dsp';
const availableProfiles = [
  'v1.0/American Clean', 'v1.0/American Vintage', 'v1.0/British Crunch', 'v1.0/Modern Metal',
  'v1.2/Classic Hard', 'v1.2/JCM800 (spice)', 'v1.2/MarkII', 'v1.2/TwinReverb (spice)',
  'supersonic_amp', 'supersonic_amp_2', 'toan_zoan',
];
const defaultProfile = availableProfiles[0];
const dspUrl = `${import.meta.env.BASE_URL}kpp_tubeamp.dsp`;  
// absolute base URL to your profiles folder in public/
const profilesBase = `${import.meta.env.BASE_URL}tubeAmp_Profiles`;
const getControlsByType = (node, ctrlType) =>
  node && node.fDescriptor
    ? node.fDescriptor.filter(descriptor => descriptor.type === ctrlType)
    : [];

export default function TubeAmp({
  id,
  context,
  factory,
  compiler,
  onPluginReady,
  pluginNodes,
  pluginProfile,
  onSlidersReady,   
   onSliderChange 
}) {
  const [node, setNode] = useState(pluginNodes ? pluginNodes[1] : null);
  const [profileSource, setProfileSource] = useState(
    pluginProfile?.source || defaultProfile
  );
  const [profile, setProfile] = useState(pluginProfile);
  const fetchRef = useRef(false);

  // compile the Faust node if not already provided
  useEffect(() => {
       if (!node && factory && context && compiler && !fetchRef.current) {
           fetchRef.current = true;
           fetch(dspUrl)
             .then(r => r.text())
             .then(async dspCode => {
               // 1) compile the DSP source into a wasm module
               await factory.compile(
                 compiler,
                 `kpp_tubeamp_${id}`,  // your unique DSP name
                 dspCode,
                 '-ftz 2'
               );
               // 2) create a live AudioWorkletNode
               const faustNode = await factory.createNode(context);
               setNode(faustNode);
             })
             .catch(err => console.error('Faust compile/create error:', err));
         }
  }, [context, factory, compiler, node, id]);

  // load impulse profile whenever node or profileSource changes
  useEffect(() => {
    if (
      context &&
      node &&
      (( !pluginNodes && !profile ) ||
        profileSource !== (profile?.source || defaultProfile))
    ) {
      const tapfUrl = `${profilesBase}/${encodeURI(profileSource)}.tapf`;
      fetch(tapfUrl)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          let offset = 0;
          const header = buffer.slice(offset, offset + profileSize);
          offset += profileSize;
          const sig = new Uint8Array(header.slice(0, 4));
          const sigStr = 'TaPf';
          for (let i = 0; i < sigStr.length; i++) {
            if (sig[i] !== sigStr.charCodeAt(i)) return;
          }
          const version = new Uint32Array(header.slice(4, 8))[0];
          const values = new Float32Array(header);
          const newProfile = values.reduce((acc, cur, idx) => {
            acc[ProfileProps[idx + 1]] = cur;
            return acc;
          }, {});
          newProfile.source = profileSource;
          newProfile.signature = sigStr;
          newProfile.version = version;
          setProfile(newProfile);

          // load impulse response
          const impHeader = buffer.slice(offset, offset + impulseSize);
          offset += impulseSize;
          const impArr = new Int32Array(impHeader);
          const sampleRate = impArr[0];
          const sampleCount = impArr[2];
          const impBytes = sampleCount * 4;
          const impBuffer = buffer.slice(offset, offset + impBytes);
          if (impBuffer.byteLength !== impBytes) return;
          const floatData = new Float32Array(impBuffer);
          const resampled = new Float32Array(
            resample(floatData, sampleRate, context.sampleRate)
          );
          const audioBuf = context.createBuffer(1, resampled.length, context.sampleRate);
          audioBuf.getChannelData(0).set(resampled);
          const convolver = new ConvolverNode(context);
          convolver.buffer = audioBuf;
          console.log('[TubeAmp] ready:', { convolver, faustNode: node });
          onPluginReady([convolver, node], tubeAmpAddr, id, newProfile);
        });
    }
  }, [context, node, profileSource, pluginNodes, profile, onPluginReady, id]);

  // apply profile defaults to the node
  useEffect(() => {
    const entries = getControlsByType(node, 'nentry');
    if (profile && entries.length) {
      entries.forEach(descriptor => {
        node.setParamValue(descriptor.address, profile[descriptor.label]);
      });
    }
  }, [node, profile]);

  const handleProfileChange = e => {
    setProfileSource(e.target.value);
  };

  const sliderMeta = React.useMemo(
      () => getControlsByType(node, 'vslider'),
      [node]
    );
  
    React.useEffect(() => {
      if (sliderMeta.length && onSlidersReady) onSlidersReady(sliderMeta);
    }, [sliderMeta, onSlidersReady]);
  
    // we’ll call this from outside when a 3‑D knob is dragged
    const setParam = React.useCallback((address, value) => {
      node && node.setParamValue(address, value);
      onSliderChange && onSliderChange(address, value);
    }, [node, onSliderChange]);
  
    // expose setParam through ref so the parent can reach it
    React.useImperativeHandle(onSlidersReady?.ref || null, () => ({ setParam }));

  if (!node) {
    return <div>Start audio to load the plugin</div>;
  }

  const sliderParams = getControlsByType(node, 'vslider');
  const handleChangeControl = (address, value) => {
    node.setParamValue(address, value);
  };

  return (
    <div className="plugin amp-head">
              node ? null : <div>Start audio to load the plugin</div>
         
      <div className="plugin-title">{node.fJSONDsp?.name}</div>

      <label htmlFor="profile">Choose Profile</label>
      <select
        id="profile"
        value={profileSource}
        onChange={handleProfileChange}
      >
        {availableProfiles.map(src => (
          <option key={src} value={src}>
            {src}
          </option>
        ))}
      </select>

      {/* <div className="knobs-wrapper" onMouseDown={stopEventPropagation}>
      {sliderParams.map(({ address, init, label, min, max, step }) => (
          <div key={address} className="knob">
            <label htmlFor={address}>{label}</label>
            <Knob
              size={50}
              angleOffset={220}
              angleRange={280}
              min={min}
              max={max}
              value={init || 0.01}
              onChange={val => handleChangeControl(address, val)}
            >
              <Arc arcWidth={0.75} />
              <circle r="20" cx="25" cy="25" />
              <Pointer width={1} height={17.5} radius={5} type="rect" />
            </Knob>
          </div>
        ))}
      </div> */}
    </div>
  );
}
