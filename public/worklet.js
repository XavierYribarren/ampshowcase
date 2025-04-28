import DSP from './dsp.js';

class Clipper extends AudioWorkletProcessor {
  constructor() {
    super();
    /* ---- set up DSP ---- */
    this.mod = DSP();
    const N = 128, bytes = 4 * N;
    this.ptrIn = this.mod._malloc(bytes);
    this.ptrOut = this.mod._malloc(bytes);
    this.bufIn  = new Float32Array(this.mod.HEAPF32.buffer, this.ptrIn,  N);
    this.bufOut = new Float32Array(this.mod.HEAPF32.buffer, this.ptrOut, N);
    this.port.onmessage = v => this.mod._setParam ? this.mod._setParam(0, v) : 0;
  }
  process([ins], [outs]) {
    if (!ins[0]) return true;
    this.bufIn.set(ins[0]);
    this.mod._process(this.ptrIn, this.ptrOut, 128);
    outs[0].set(this.bufOut);
    return true;
  }
}
registerProcessor('clipper', Clipper);
