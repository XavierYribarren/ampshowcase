// src/features/tubeAmp/TubeAmp.jsx
import React, {
  useState, useEffect, useRef, useMemo,
  forwardRef, useImperativeHandle, useCallback
} from 'react';
import { resample } from 'wave-resampler';
import { ProfileProps, profileSize, impulseSize } from './profile';

const DSP_ADDR = 'kpp_tubeamp.dsp';
const dspURL   = `${import.meta.env.BASE_URL}kpp_tubeamp.dsp`;
const baseIR   = `${import.meta.env.BASE_URL}tubeAmp_Profiles`;

const profiles = [
  'v1.0/American Clean', 'v1.0/American Vintage', 'v1.0/British Crunch',
  'v1.0/Modern Metal',   'v1.2/Classic Hard',     'v1.2/JCM800 (spice)',
  'v1.2/MarkII',         'v1.2/TwinReverb (spice)',
  'supersonic_amp',      'supersonic_amp_2',      'toan_zoan'
];
const defaultProfile = profiles[0];

/* helper */
const getByType = (n, t) => n?.fDescriptor?.filter(d => d.type === t) || [];

/* virtual knob */
const PRE_GAIN = {
  label: 'preGain', address: '/preGain', type: 'vslider',
  min: 0, max: 40, init: 1, step: 0.01
};
const ORDER = ['pregain', 'drive', 'bass', 'middle', 'treble', 'volume'];

const TubeAmp = forwardRef(function TubeAmp(
  {
    id, context, compiler, factory,
    onPluginReady,
    pluginNodes, pluginProfile,
    onSlidersReady, onSliderChange
  },
  ref
) {
  /* ─── state refs ─────────────────────────────────────────────── */
  const [faustNode, setFaustNode]   = useState(pluginNodes ? pluginNodes[1] : null);
  const [profileSrc, setProfileSrc] = useState(pluginProfile?.source || defaultProfile);
  const [profile,    setProfile]    = useState(pluginProfile);

  const preGainRef  = useRef(null);
  const convRef     = useRef(null);
  const fetched     = useRef(false);
  const defaultsSet = useRef(false);

/* ─── compile Faust once ─────────────────────────────────────── */
useEffect(() => {
  if (faustNode || !context || !compiler || !factory || fetched.current) return;
  fetched.current = true;

  fetch(dspURL)
    .then(r => r.text())
    .then(async code => {
      // 1) compile the DSP into WASM
      await factory.compile(compiler, `kpp_tubeamp_${id}`, code, '-ftz 2');
      // 2) create the Faust AudioWorkletNode
      const node = await factory.createNode(context);

      // 3) create a pre-gain stage and hook it up
      const g = context.createGain();
      g.gain.value = 1;
      g.connect(node);
      preGainRef.current = g;

      // 4) now that everything’s wired, expose the Faust node
      setFaustNode(node);
    })
    .catch(err => console.error('[TubeAmp] compile error', err));
}, [context, compiler, factory, faustNode, id]);


/* ─── load / switch profile & build IR ─────────────────────────── */
useEffect(() => {
  if (!context || !faustNode) return;
  if (profile && profileSrc === profile.source) return;

  fetch(`${baseIR}/${encodeURI(profileSrc)}.tapf`)
    .then(r => r.arrayBuffer())
    .then(buffer => {
      let offset = 0;

      const header = buffer.slice(offset, offset + profileSize);
      offset += profileSize;
      const f32  = new Float32Array(header);
      const prof = f32.reduce((acc, cur, idx) => {
        acc[ProfileProps[idx + 1]] = cur;
        return acc;
      }, {});
      prof.source = profileSrc;
      setProfile(prof);

      // 🔧 Apply new profile values to faustNode
      const entries = faustNode.fDescriptor?.filter(d => d.type === 'nentry') || [];
      entries.forEach(d => {
        const val = prof[d.label];
        if (val !== undefined) {
          faustNode.setParamValue(d.address, val);
        }
      });

      const impHeader = buffer.slice(offset, offset + impulseSize);
      offset += impulseSize;
      const info       = new Int32Array(impHeader);
      const sampleCount = info[2];
      const impBytes   = sampleCount * 4;
      const impBuffer  = buffer.slice(offset, offset + impBytes);
      const impArray   = new Float32Array(impBuffer);
      const resamp     = resample(impArray, info[0], context.sampleRate);

      const irBuffer = context.createBuffer(1, resamp.length, context.sampleRate);
      irBuffer.getChannelData(0).set(resamp);

      // 🔧 Reuse convolver
      if (!convRef.current) {
        convRef.current = new ConvolverNode(context);
        faustNode.connect(convRef.current);
      }

      convRef.current.buffer = irBuffer;

      // Notify parent
      onPluginReady([convRef.current, faustNode], DSP_ADDR, id, prof);
    })
    .catch(err => console.error('[TubeAmp] profile load error', err));
}, [context, faustNode, profileSrc, onPluginReady, id, profile]);


  /* ─── apply defaults once ────────────────────────────────────── */
  useEffect(() => {
    if (!faustNode || !profile || defaultsSet.current) return;
    getByType(faustNode, 'nentry').forEach(d =>
      faustNode.setParamValue(d.address, profile[d.label])
    );
    defaultsSet.current = true;
  }, [faustNode, profile]);

  /* ─── build slider descriptors (virtual + real) ──────────────── */
  const sliderMeta = useMemo(() => {
    if (!faustNode) return [];
    const real = getByType(faustNode, 'vslider').map(d => {
      if (d.label.toLowerCase() === 'mastergain') d.label = 'Volume';
      return d;
    });
    const meta = [...real, { ...PRE_GAIN }];
    meta.sort(
      (a, b) => ORDER.indexOf(a.label.toLowerCase()) -
                ORDER.indexOf(b.label.toLowerCase())
    );
    return meta;
  }, [faustNode]);

  useEffect(() => {
    sliderMeta.length && onSlidersReady?.(sliderMeta);
  }, [sliderMeta, onSlidersReady]);

  /* ─── expose setParam ────────────────────────────────────────── */
  const setParam = useCallback((addr, v) => {
    if (addr === '/preGain') {
      preGainRef.current && (preGainRef.current.gain.value = v);
    } else {
      faustNode?.setParamValue(addr, v);
    }
    onSliderChange?.(addr, v);
  }, [faustNode, onSliderChange]);

  useImperativeHandle(ref, () => ({ setParam }), [setParam]);

  /* ─── minimal UI (no HTML knobs) ────────────────────────────── */
  if (!faustNode) return <div>Start audio to load the plugin…</div>;

  return (
    <div className="plugin amp-head">
      {/* <div className="plugin-title">{faustNode.fJSONDsp?.name}</div> */}
      <label htmlFor="profile">Choose&nbsp;Profile&nbsp;</label>
      <select
        id="profile"
        value={profileSrc}
        onChange={e => setProfileSrc(e.target.value)}
      >
        {profiles.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  );
});

export default TubeAmp;
