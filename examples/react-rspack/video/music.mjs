// The music of the intro video, synthesized from code like the frames: deterministic, no samples, nothing
// to license. 120 BPM, one chord per bar (Am F C G, ending G → C), a plucked arpeggio with a ping-pong
// echo, a pad, an off-beat bass, kick, hats and claps. Drums sit out the first two bars and the last one.
import fs from 'node:fs';

const RATE = 44100;
const BEAT = 60 / 120;
const BAR = BEAT * 4;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const TAU = Math.PI * 2;

// MIDI notes. Am, F, C, G.
const PROGRESSION = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
];
const ARP = [0, 1, 2, 3, 2, 1, 3, 4, 0, 1, 2, 3, 4, 3, 2, 1];

function renderMusic(duration) {
  const n = Math.ceil(duration * RATE);
  const bus = () => [new Float32Array(n), new Float32Array(n)];
  const music = bus();
  const arp = bus();
  const drums = bus();
  const duck = new Float32Array(n).fill(1);

  let seed = 7;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 31 - 1;
  };
  // Add fn(t) to a bus from `start` for `len` seconds, with a left/right gain.
  const add = ([l, r], start, len, fn, gl = 1, gr = 1) => {
    const s0 = Math.round(start * RATE);
    const s1 = Math.min(n, s0 + Math.round(len * RATE));
    for (let i = Math.max(0, s0); i < s1; i++) {
      const v = fn((i - s0) / RATE);
      l[i] += v * gl;
      r[i] += v * gr;
    }
  };

  const kick = (at) => {
    add(drums, at, 0.4, (t) => {
      const phase = TAU * (45 * t + (110 * (1 - Math.exp(-30 * t))) / 30);
      return Math.sin(phase) * Math.exp(-7 * t) * 0.9;
    });
    const s0 = Math.round(at * RATE);
    for (let i = s0; i < Math.min(n, s0 + 0.45 * RATE); i++) {
      duck[i] = Math.min(duck[i], 1 - 0.5 * Math.exp(-((i - s0) / RATE) * 9));
    }
  };
  const hat = (at, gain) => {
    let prev = 0;
    add(
      drums,
      at,
      0.07,
      (t) => {
        const x = noise();
        const v = x - prev;
        prev = x;
        return v * Math.exp(-60 * t) * gain;
      },
      0.8,
      1,
    );
  };
  const clap = (at) => {
    let low = 0;
    let band = 0;
    add(drums, at, 0.25, (t) => {
      // State-variable band-pass around 1.4 kHz; three short bursts, then a tail.
      const f = 2 * Math.sin((Math.PI * 1400) / RATE);
      const high = noise() - low - 0.6 * band;
      band += f * high;
      low += f * band;
      const bursts = t < 0.03 ? 0.6 + 0.4 * Math.cos(TAU * 100 * t) : 1;
      return band * bursts * Math.exp(-22 * t) * 0.5;
    });
  };
  const crash = (at) => {
    let prev = 0;
    add(
      drums,
      at,
      2,
      (t) => {
        const x = noise();
        const v = x - prev;
        prev = x;
        return v * Math.exp(-2.5 * t) * 0.06;
      },
      1,
      0.85,
    );
  };
  const pad = (chord, at, len) => {
    for (const note of chord) {
      for (const [cents, gl, gr] of [
        [-7, 1, 0.35],
        [7, 0.35, 1],
      ]) {
        const f = hz(note) * 2 ** (cents / 1200);
        add(
          music,
          at,
          len + 0.4,
          (t) => {
            const env = Math.min(1, t / 0.3) * (t > len ? Math.exp(-(t - len) * 9) : 1);
            const p = TAU * f * t;
            return (Math.sin(p) + Math.sin(3 * p) / 9 + Math.sin(5 * p) / 25) * env * 0.045;
          },
          gl,
          gr,
        );
      }
    }
  };
  const bass = (note, at) => {
    const f = hz(note);
    add(music, at, BEAT / 2, (t) => {
      let v = 0;
      for (let k = 1; k <= 10; k++) v += (Math.sin(TAU * k * f * t) / k) * Math.exp(-k * 0.3);
      return v * Math.exp(-6 * t) * Math.min(1, t / 0.004) * 0.3;
    });
  };
  const pluck = (note, at, gain, left) => {
    const f = hz(note);
    add(
      arp,
      at,
      0.6,
      (t) => {
        const p = TAU * f * t;
        const v =
          Math.sin(p) +
          0.5 * Math.sin(2 * p) * Math.exp(-20 * t) +
          0.25 * Math.sin(3 * p) * Math.exp(-30 * t);
        return v * Math.exp(-9 * t) * Math.min(1, t / 0.002) * gain;
      },
      left ? 1 : 0.6,
      left ? 0.6 : 1,
    );
  };

  const bars = Math.ceil(duration / BAR);
  for (let b = 0; b < bars; b++) {
    const at = b * BAR;
    const last = b === bars - 1;
    let chord = PROGRESSION[b % 4];
    if (b === bars - 2) chord = PROGRESSION[3];
    if (last) chord = PROGRESSION[2];
    const tones = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24, chord[1] + 24];
    const intro = b < 2;

    pad(chord, at, last ? duration - at - 0.4 : BAR);
    if (last) {
      kick(at);
      crash(at);
      bass(chord[0] - 24, at);
      pluck(tones[3], at, 0.14, true);
      pluck(tones[2], at + BEAT / 2, 0.1, false);
      continue;
    }
    for (let s = 0; s < 16; s++) {
      const gain = (intro ? 0.06 + 0.04 * ((b * 16 + s) / 32) : 0.11) * (s % 4 === 0 ? 1 : 0.8);
      pluck(tones[ARP[s]], at + (s * BEAT) / 4, gain, s % 2 === 0);
    }
    if (b === 1) for (let s = 8; s < 16; s++) hat(at + (s * BEAT) / 4, 0.03 + 0.008 * (s - 8));
    if (intro) continue;
    if (b === 2) crash(at);
    for (let beat = 0; beat < 4; beat++) {
      const t = at + beat * BEAT;
      kick(t);
      hat(t + BEAT / 2, 0.16);
      if (b >= 6) hat(t + BEAT / 4, 0.06);
      if (b >= 6) hat(t + (3 * BEAT) / 4, 0.06);
      if (b >= 4 && beat % 2 === 1) clap(t);
      bass(chord[0] - 24, t + BEAT / 2);
    }
    bass(chord[0] - 24, at);
  }

  // Ping-pong echo on the arpeggio, three sixteenths apart.
  const delay = Math.round(((3 * BEAT) / 4) * RATE);
  for (let i = delay; i < n; i++) {
    arp[0][i] += arp[1][i - delay] * 0.35;
    arp[1][i] += arp[0][i - delay] * 0.35;
  }

  // Mix: the kick ducks the pad, bass and arpeggio; soft clip; normalize; fade in and out.
  const out = [new Float32Array(n), new Float32Array(n)];
  let peak = 0;
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < n; i++) {
      const v = Math.tanh(1.3 * ((music[c][i] + arp[c][i]) * duck[i] + drums[c][i]));
      out[c][i] = v;
      peak = Math.max(peak, Math.abs(v));
    }
  }
  const fadeIn = 0.05 * RATE;
  const fadeOut = 1.5 * RATE;
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < n; i++) {
      const g = Math.min(1, i / fadeIn, (n - i) / fadeOut);
      out[c][i] = (out[c][i] / peak) * 0.89 * g;
    }
  }
  return out;
}

export function writeMusic(file, duration) {
  const [l, r] = renderMusic(duration);
  const n = l.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(l[i] * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r[i] * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}
