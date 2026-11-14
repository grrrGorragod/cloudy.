// เพลงพื้นหลังเบาๆ สร้างเสียงสดด้วย Web Audio ไม่มีไฟล์เพลง ไม่มีลิขสิทธิ์
// แพดนุ่มๆ เปลี่ยนคอร์ดช้าๆ + เสียงกล่องดนตรีเป็นจังหวะห่างๆ + เสียงสะท้อนยาว

const CHORD_SEC = 8; // คอร์ดละ 8 วินาที วนซ้ำ
const CHORDS = [
  [130.81, 164.81, 196.0, 246.94], // Cmaj7
  [110.0, 164.81, 196.0, 261.63],  // Am7
  [87.31, 130.81, 220.0, 329.63],  // Fmaj7
  [98.0, 146.83, 246.94, 329.63]   // G6
];
const BELLS = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C เพนทาโทนิก

function makeImpulse(ctx, seconds = 3.2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

// สร้างสายเสียงทั้งหมด คืนจุดเสียบสำหรับแพด/ระฆัง และก้อน master
export function buildChain(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);

  const dry = ctx.createGain(); dry.gain.value = 0.7; dry.connect(master);
  const wet = ctx.createGain(); wet.gain.value = 0.6; wet.connect(master);
  const verb = ctx.createConvolver(); verb.buffer = makeImpulse(ctx); verb.connect(wet);

  const pad = ctx.createGain(); pad.gain.value = 0.5;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1100; lp.Q.value = 0.3;
  pad.connect(lp); lp.connect(dry); lp.connect(verb);

  const bell = ctx.createGain(); bell.gain.value = 0.7;
  bell.connect(dry); bell.connect(verb);
  return { master, pad, bell };
}

export function scheduleChord(ctx, chain, t0, idx) {
  const notes = CHORDS[idx % CHORDS.length];
  const end = t0 + CHORD_SEC;
  for (const f of notes) {
    for (const [type, detune, level] of [["sine", -5, 0.5], ["triangle", 6, 0.22]]) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f; o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(level * 0.22, t0 + 3);
      g.gain.setValueAtTime(level * 0.22, end);
      g.gain.linearRampToValueAtTime(0, end + 4);
      o.connect(g).connect(chain.pad);
      o.start(t0); o.stop(end + 4.2);
    }
  }
}

export function scheduleBells(ctx, chain, from, to, state) {
  while (state.next < to) {
    const t = Math.max(state.next, from);
    let f;
    do { f = BELLS[Math.floor(Math.random() * BELLS.length)]; } while (f === state.last);
    state.last = f;
    for (const [mult, level] of [[1, 0.06], [2, 0.012]]) {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
      let out = g;
      if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.2 - 0.6; g.connect(p); out = p; }
      o.connect(g); out.connect(chain.bell);
      o.start(t); o.stop(t + 4.6);
    }
    state.next += 3.5 + Math.random() * 3.5;
  }
}

export class AmbientPlayer {
  constructor() { this.ctx = null; this.timer = null; this.playing = false; }

  async start() {
    if (this.playing) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC();
      this.chain = buildChain(this.ctx);
    }
    await this.ctx.resume();
    this.playing = true;
    const ctx = this.ctx;
    this.chordIdx = 0;
    this.nextChord = ctx.currentTime + 0.1;
    this.bellState = { next: ctx.currentTime + 2, last: 0 };
    this.chain.master.gain.cancelScheduledValues(ctx.currentTime);
    this.chain.master.gain.setTargetAtTime(0.8, ctx.currentTime, 1.2); // ค่อยๆ ดังขึ้น
    const tick = () => {
      const now = ctx.currentTime;
      while (this.nextChord < now + 6) {
        scheduleChord(ctx, this.chain, this.nextChord, this.chordIdx++);
        this.nextChord += CHORD_SEC;
      }
      scheduleBells(ctx, this.chain, now, now + 6, this.bellState);
    };
    tick();
    this.timer = setInterval(tick, 1000);
  }

  async stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const ctx = this.ctx;
    this.chain.master.gain.setTargetAtTime(0, ctx.currentTime, 0.5); // ค่อยๆ เบาลง
    setTimeout(() => { if (!this.playing) ctx.suspend().catch(() => {}); }, 2500);
  }
}