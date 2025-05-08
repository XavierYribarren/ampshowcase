import React, {
  useState, useEffect, useRef, useMemo,
  forwardRef, useImperativeHandle, useCallback
} from 'react';
import { resample } from 'wave-resampler';
import { ProfileProps, profileSize, impulseSize } from './profile';
import Select from 'react-select';
import CustomDropdown from '../../helpers/CustomDropdown';


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
        await factory.compile(compiler, `kpp_tubeamp_${id}`, code, '-ftz 2');
        const node = await factory.createNode(context);
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

        if (!convRef.current) {
          convRef.current = new ConvolverNode(context);
          faustNode.connect(convRef.current);
        }

        convRef.current.buffer = irBuffer;
        onPluginReady([convRef.current, faustNode], DSP_ADDR, id, prof);
      })
      .catch(err => console.error('[TubeAmp] profile load error', err));
  }, [context, faustNode, profileSrc, onPluginReady, id, profile]);

  /* ─── apply defaults once ────────────────────────────────────── */
  useEffect(() => {
    if (!faustNode || !profile || defaultsSet.current) return;
    getByType(faustNode, 'nentry').forEach(d => {
      const value = profile[d.label];
      if (typeof value === 'number' && isFinite(value)) {
        faustNode.setParamValue(d.address, value);
      }
    });
    defaultsSet.current = true;
  }, [faustNode, profile]);
  

  /* ─── build slider descriptors (remove duplicate pregain) ────── */
  const sliderMeta = useMemo(() => {
    if (!faustNode) return [];
    const real = getByType(faustNode, 'vslider')
      .map(d => {
        // if (d.label.toLowerCase() === 'mastergain') d.label = 'Volume';
        return d;
      });
    real.sort(
      (a, b) => ORDER.indexOf(a.label.toLowerCase()) -
                ORDER.indexOf(b.label.toLowerCase())
    );
    return real;
  }, [faustNode]);

  useEffect(() => {
    sliderMeta.length && onSlidersReady?.(sliderMeta);
  }, [sliderMeta, onSlidersReady]);

  /* ─── expose setParam ────────────────────────────────────────── */
  const setParam = useCallback((addr, v) => {
    faustNode?.setParamValue(addr, v);
    onSliderChange?.(addr, v);
  }, [faustNode, onSliderChange]);

  useImperativeHandle(ref, () => ({ setParam }), [setParam]);

  if (!faustNode) return <div>Start audio to load the plugin…</div>;


  const options = profiles.map(p => ({ value: p, label: p }));
  return (
    <div className="plugin amp-head">
      <div htmlFor="profile">Amp style:</div>
      {/* <select
        id="profile"
        value={profileSrc}
        onChange={e => setProfileSrc(e.target.value)}
        className='amp-dropdown'
      >
        {profiles.map(p => <option className='profile-option' key={p} value={p}>{p}</option>)}
      </select> */}
     <CustomDropdown
  options={profiles}
  value={profileSrc}
  onChange={val => setProfileSrc(val)}
/>
    </div>
  );
});

export default TubeAmp;
