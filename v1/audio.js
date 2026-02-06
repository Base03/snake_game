// =========================================
// AUDIO ENGINE v2 - Effect → Track → Song
// =========================================
const AudioEngine = (() => {
  let actx = null;
  let master = null;    // GainNode
  let enabled = false;
  let started = false;
  let corruption = 0;

  // ---- NOTE FREQUENCY TABLE ----
  const FREQ = {};
  const NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  for (let oct = 0; oct <= 7; oct++) {
    for (let i = 0; i < 12; i++) {
      FREQ[NAMES[i] + oct] = 440 * Math.pow(2, (i - 9) / 12 + (oct - 4));
    }
  }
  // Enharmonic aliases
  const ALIAS = {
    'C#':'Db','D#':'Eb','F#':'Gb','G#':'Ab','A#':'Bb',
    'Cb':'B','Fb':'E','E#':'F','B#':'C'
  };
  function noteFreq(name) {
    if (!name || name === '-') return 0;
    // Try direct lookup
    if (FREQ[name]) return FREQ[name];
    // Try alias: extract note part and octave
    const m = name.match(/^([A-G][b#]?)(\d)$/);
    if (m && ALIAS[m[1]]) return FREQ[ALIAS[m[1]] + m[2]] || 0;
    return 0;
  }

  // ===========================================
  // EFFECT - wraps persistent Web Audio nodes
  // ===========================================
  class Effect {
    constructor(type, params = {}) {
      this.type = type;
      this.params = { ...params };
      this.nodes = [];    // created on connect()
      this.input = null;
      this.output = null;
    }

    // Build the audio subgraph. Called once when track is wired up.
    build(ctx) {
      switch (this.type) {
        case 'distortion': {
          const ws = ctx.createWaveShaper();
          ws.oversample = '2x';
          this._shaper = ws;
          this.input = ws;
          this.output = ws;
          this.updateCurve(this.params.amount || 0);
          break;
        }
        case 'tremolo': {
          // LFO → gain modulation
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          const wet = ctx.createGain();
          lfo.type = 'sine';
          lfo.frequency.value = this.params.rate || 5;
          lfoGain.gain.value = this.params.depth || 0;
          lfo.connect(lfoGain);
          lfoGain.connect(wet.gain);
          wet.gain.value = 1;
          lfo.start();
          this._lfo = lfo;
          this._lfoGain = lfoGain;
          this.input = wet;
          this.output = wet;
          break;
        }
        case 'filter': {
          const f = ctx.createBiquadFilter();
          f.type = this.params.filterType || 'lowpass';
          f.frequency.value = this.params.freq || 1000;
          f.Q.value = this.params.Q || 1;
          this._filter = f;
          this.input = f;
          this.output = f;
          break;
        }
        case 'reverb': {
          // Convolution reverb with procedural IR
          const conv = ctx.createConvolver();
          const decay = this.params.decay || 2.5;
          const len = ctx.sampleRate * decay;
          const buf = ctx.createBuffer(2, len, ctx.sampleRate);
          for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) {
              d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
            }
          }
          conv.buffer = buf;
          // Dry/wet mix
          const dry = ctx.createGain();
          const wet = ctx.createGain();
          const out = ctx.createGain();
          dry.gain.value = 1 - (this.params.mix || 0.3);
          wet.gain.value = this.params.mix || 0.3;
          // input → dry → out
          // input → conv → wet → out
          dry.connect(out);
          conv.connect(wet);
          wet.connect(out);
          this._dry = dry;
          this._wet = wet;
          this._conv = conv;
          // input is a passthrough that feeds both
          const split = ctx.createGain();
          split.connect(dry);
          split.connect(conv);
          this.input = split;
          this.output = out;
          break;
        }
        default: {
          // Passthrough
          const g = ctx.createGain();
          g.gain.value = 1;
          this.input = g;
          this.output = g;
        }
      }
    }

    // Update parameters on an already-built effect
    update(params) {
      Object.assign(this.params, params);
      switch (this.type) {
        case 'distortion':
          if (this._shaper) this.updateCurve(this.params.amount || 0);
          break;
        case 'tremolo':
          if (this._lfo) this._lfo.frequency.value = this.params.rate || 5;
          if (this._lfoGain) this._lfoGain.gain.value = this.params.depth || 0;
          break;
        case 'filter':
          if (this._filter) {
            this._filter.frequency.value = this.params.freq || 1000;
            this._filter.Q.value = this.params.Q || 1;
          }
          break;
        case 'reverb':
          if (this._dry) this._dry.gain.value = 1 - (this.params.mix || 0.3);
          if (this._wet) this._wet.gain.value = this.params.mix || 0.3;
          break;
      }
    }

    updateCurve(amount) {
      if (!this._shaper) return;
      const n = 256;
      const curve = new Float32Array(n);
      if (amount < 0.01) {
        // Clean passthrough
        for (let i = 0; i < n; i++) curve[i] = (i * 2 / n) - 1;
      } else {
        for (let i = 0; i < n; i++) {
          const x = (i * 2 / n) - 1;
          curve[i] = (Math.PI + amount) * x * 0.318 / (Math.PI + amount * Math.abs(x));
        }
      }
      this._shaper.curve = curve;
    }
  }

  // ===========================================
  // INSTRUMENT - defines synthesis for a voice
  // ===========================================
  // Each instrument is a config object:
  // {
  //   stops: [{h: harmonic, type: 'sine'|'triangle'|..., vol: baseVol}, ...],
  //   attack: seconds,
  //   release: seconds,
  //   type: 'organ' | 'choir' | 'sfx'
  //   // choir-specific:
  //   voices: count,
  //   formants: [{freq, Q}, ...],
  // }

  const INSTRUMENTS = {
    organBass: {
      type: 'organ',
      stops: [
        { h: 0.5,  type: 'sine',     vol: 0.20 },  // 16' sub
        { h: 1,    type: 'sine',     vol: 0.55 },  // 8' diapason
        { h: 1,    type: 'triangle', vol: 0.15 },  // 8' flute
        { h: 2,    type: 'sine',     vol: 0.10 },  // 4' principal
      ],
      attack: 0.06, release: 0.12,
    },
    organTenor: {
      type: 'organ',
      stops: [
        { h: 1,    type: 'sine',     vol: 0.50 },
        { h: 1,    type: 'triangle', vol: 0.18 },
        { h: 2,    type: 'sine',     vol: 0.14 },
        { h: 2.67, type: 'sine',     vol: 0.05 },
        { h: 4,    type: 'sine',     vol: 0.06 },
      ],
      attack: 0.06, release: 0.12,
    },
    organAlto: {
      type: 'organ',
      stops: [
        { h: 1,    type: 'sine',     vol: 0.45 },
        { h: 1,    type: 'triangle', vol: 0.20 },
        { h: 2,    type: 'sine',     vol: 0.16 },
        { h: 2.67, type: 'sine',     vol: 0.06 },
        { h: 4,    type: 'sine',     vol: 0.08 },
        { h: 8,    type: 'sine',     vol: 0.02 },
      ],
      attack: 0.06, release: 0.12,
    },
    organSoprano: {
      type: 'organ',
      stops: [
        { h: 1,    type: 'sine',     vol: 0.45 },
        { h: 1,    type: 'triangle', vol: 0.22 },
        { h: 2,    type: 'sine',     vol: 0.18 },
        { h: 2.67, type: 'sine',     vol: 0.06 },
        { h: 4,    type: 'sine',     vol: 0.10 },
        { h: 8,    type: 'sine',     vol: 0.03 },
      ],
      attack: 0.06, release: 0.10,
    },
    organPedal: {
      type: 'organ',
      stops: [
        { h: 0.5,  type: 'sine',     vol: 0.60 },  // 32' sub
        { h: 1,    type: 'sine',     vol: 0.40 },  // 16'
      ],
      attack: 0.08, release: 0.15,
    },
    choir: {
      type: 'choir',
      voices: 3,
      formants: [
        { freq: 700, Q: 10 },   // F1
        { freq: 1200, Q: 10 },  // F2
      ],
      attack: 0.15, release: 0.18,
    },
    // SFX instruments - simple waveforms
    sfxTone: {
      type: 'organ',
      stops: [{ h: 1, type: 'square', vol: 1.0 }],
      attack: 0.005, release: 0.01,
    },
    sfxSine: {
      type: 'organ',
      stops: [{ h: 1, type: 'sine', vol: 1.0 }],
      attack: 0.005, release: 0.01,
    },
    sfxSaw: {
      type: 'organ',
      stops: [{ h: 1, type: 'sawtooth', vol: 1.0 }],
      attack: 0.005, release: 0.01,
    },
    sfxNoise: {
      type: 'noise',
      attack: 0.003, release: 0.01,
    },
  };

  // ===========================================
  // TRACK - instrument voice + effect chain
  // ===========================================
  class Track {
    constructor(name, instrumentKey, effectDefs = [], volume = 1.0) {
      this.name = name;
      this.instrument = INSTRUMENTS[instrumentKey];
      this.effectDefs = effectDefs;   // [{type, params}]
      this.baseVolume = volume;
      this.effects = [];
      this.gain = null;   // GainNode
      this.built = false;
      this._noiseBuffer = null;
    }

    // Wire up: source → effects[0] → ... → effects[n] → trackGain → destination
    build(ctx, destination) {
      this.gain = ctx.createGain();
      this.gain.gain.value = this.baseVolume;
      this.gain.connect(destination);

      // Build effects
      this.effects = this.effectDefs.map(def => {
        const e = new Effect(def.type, def.params || {});
        e.build(ctx);
        return e;
      });

      // Chain: last effect → gain. each effect.output → next effect.input
      if (this.effects.length > 0) {
        for (let i = 0; i < this.effects.length - 1; i++) {
          this.effects[i].output.connect(this.effects[i + 1].input);
        }
        this.effects[this.effects.length - 1].output.connect(this.gain);
      }

      // Pre-generate noise buffer for noise instruments
      if (this.instrument.type === 'noise') {
        const len = ctx.sampleRate * 2;
        this._noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this._noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }

      this.built = true;
    }

    // The input node that sources connect to (first effect, or gain if no effects)
    get inputNode() {
      return this.effects.length > 0 ? this.effects[0].input : this.gain;
    }

    // Play a note through this track's instrument and effect chain
    play(ctx, note, time, duration, volMult = 1.0) {
      if (!this.built) return;
      const freq = typeof note === 'number' ? note : noteFreq(note);
      if (freq <= 0 && this.instrument.type !== 'noise') return;

      const inst = this.instrument;
      const dest = this.inputNode;
      const vol = volMult;
      const atk = inst.attack || 0.01;
      const rel = inst.release || 0.01;

      if (inst.type === 'organ') {
        // Organ: multiple harmonic stops
        const envGain = ctx.createGain();
        envGain.gain.setValueAtTime(0, time);
        envGain.gain.linearRampToValueAtTime(vol, time + atk);
        if (duration > atk + rel) {
          envGain.gain.setValueAtTime(vol, time + duration - rel);
        }
        envGain.gain.linearRampToValueAtTime(0, time + duration);
        envGain.connect(dest);

        for (const stop of inst.stops) {
          const osc = ctx.createOscillator();
          osc.type = stop.type;
          osc.frequency.value = freq * stop.h;
          const sGain = ctx.createGain();
          sGain.gain.value = stop.vol;
          osc.connect(sGain);
          sGain.connect(envGain);
          osc.start(time);
          osc.stop(time + duration + 0.05);
        }
      } else if (inst.type === 'choir') {
        // Choir: formant-filtered sawtooth voices
        const voiceCount = inst.voices || 3;
        for (let v = 0; v < voiceCount; v++) {
          const dt = Math.random() * 0.03;
          const t = time + dt;

          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          osc.detune.value = (v - voiceCount / 2) * 8 + (Math.random() - 0.5) * 6;

          // Vibrato
          const vib = ctx.createOscillator();
          const vibG = ctx.createGain();
          vib.frequency.value = 4.2 + Math.random() * 0.8;
          vibG.gain.value = 3;
          vib.connect(vibG);
          vibG.connect(osc.frequency);
          vib.start(t);
          vib.stop(t + duration + 0.1);

          // Formant filters → merge
          const merge = ctx.createGain();
          merge.gain.value = 0.5 / (inst.formants.length || 1);
          for (const fm of (inst.formants || [])) {
            const bf = ctx.createBiquadFilter();
            bf.type = 'bandpass';
            bf.frequency.value = fm.freq;
            bf.Q.value = fm.Q;
            osc.connect(bf);
            bf.connect(merge);
          }

          const envGain = ctx.createGain();
          envGain.gain.setValueAtTime(0, t);
          envGain.gain.linearRampToValueAtTime(vol / voiceCount, t + duration * (inst.attack || 0.15));
          envGain.gain.setValueAtTime(vol / voiceCount, t + duration * (1 - (inst.release || 0.18)));
          envGain.gain.linearRampToValueAtTime(0, t + duration);

          merge.connect(envGain);
          envGain.connect(dest);
          osc.start(t);
          osc.stop(t + duration + 0.05);
        }
      } else if (inst.type === 'noise') {
        // Noise burst
        if (!this._noiseBuffer) return;
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuffer;
        const envGain = ctx.createGain();
        envGain.gain.setValueAtTime(0, time);
        envGain.gain.linearRampToValueAtTime(vol, time + (inst.attack || 0.003));
        if (duration > 0.02) {
          envGain.gain.setValueAtTime(vol, time + duration - (inst.release || 0.01));
        }
        envGain.gain.linearRampToValueAtTime(0, time + duration);
        src.connect(envGain);
        envGain.connect(dest);
        src.start(time);
        src.stop(time + duration + 0.05);
      }
    }

    // Update all effects on this track
    updateEffects(paramsByType) {
      for (const e of this.effects) {
        if (paramsByType[e.type]) {
          e.update(paramsByType[e.type]);
        }
      }
    }

    setVolume(v) {
      if (this.gain) this.gain.gain.value = v;
    }
  }

  // ===========================================
  // SONG - collection of tracks + sequence data
  // ===========================================
  // Sequence format per track:
  //   [ ["C4", 4], ["-", 2], ["E4", 4], ... ]
  //   note name (or "-" for rest), duration in beats
  //
  // A Song stores: { bpm, tracks: {name: Track}, sequences: {trackName: [...]} }
  class Song {
    constructor(name, bpm) {
      this.name = name;
      this.bpm = bpm;
      this.tracks = {};        // name → Track
      this.sequences = {};     // name → [["note", beats], ...]
      this.gain = null;        // song-level GainNode
      this.built = false;

      // Playback state (managed by Scheduler)
      this._beatIndex = 0;
      // Per-track: which event index and how many beats consumed
      this._trackState = {};   // trackName → { eventIdx, beatsConsumed }
    }

    addTrack(track) {
      this.tracks[track.name] = track;
    }

    setSequence(trackName, seq) {
      this.sequences[trackName] = seq;
      // Ensure track state exists (build/reset may have run before sequences were set)
      if (!this._trackState[trackName]) {
        this._trackState[trackName] = { eventIdx: 0, beatsConsumed: 0 };
      }
    }

    build(ctx, destination) {
      this.gain = ctx.createGain();
      this.gain.gain.value = 1.0;
      this.gain.connect(destination);
      for (const t of Object.values(this.tracks)) {
        t.build(ctx, this.gain);
      }
      this.built = true;
      this.reset();
    }

    reset() {
      this._beatIndex = 0;
      this._trackState = {};
      for (const name of Object.keys(this.sequences)) {
        this._trackState[name] = { eventIdx: 0, beatsConsumed: 0 };
      }
    }

    setVolume(v) {
      if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, v));
    }

    // Called by Scheduler: "beat N should play at audio time T"
    onBeat(ctx, beatIndex, audioTime) {
      if (!this.built) return;
      const beatDur = 60 / this.bpm; // duration of one beat in seconds

      for (const [trackName, seq] of Object.entries(this.sequences)) {
        const track = this.tracks[trackName];
        const state = this._trackState[trackName];
        if (!track || !state || seq.length === 0) continue;

        // Wrap around
        const evIdx = state.eventIdx % seq.length;
        const ev = seq[evIdx];
        const note = ev[0];
        const durBeats = ev[1];

        // Is this the first beat of this event?
        if (state.beatsConsumed === 0 && note !== '-') {
          // Play the note, held for its full duration
          const noteDur = durBeats * beatDur;
          const vol = ev[2] !== undefined ? ev[2] : 1.0;
          track.play(ctx, note, audioTime, noteDur, vol);
        }

        // Advance
        state.beatsConsumed++;
        if (state.beatsConsumed >= durBeats) {
          state.beatsConsumed = 0;
          state.eventIdx++;
          // Loop
          if (state.eventIdx >= seq.length) {
            state.eventIdx = 0;
          }
        }
      }

      this._beatIndex = beatIndex;
    }
  }

  // ===========================================
  // SCHEDULER - single clock, drives all songs
  // ===========================================
  // Lookahead pattern: setInterval polls, schedules beats
  // ahead of time using actx.currentTime for sample-accurate timing
  const SCHED_INTERVAL = 25;   // ms between checks
  const SCHED_AHEAD = 0.1;     // schedule beats this far ahead (seconds)

  let schedSongs = [];          // Song[] - all active songs
  let schedRunning = false;
  let schedTimer = null;
  let schedNextBeatTime = 0;    // actx.currentTime of next beat
  let schedBeatIndex = 0;
  let schedBPM = 72;            // master BPM (in quarter notes)

  function schedStart(bpm) {
    schedBPM = bpm;
    schedBeatIndex = 0;
    schedNextBeatTime = actx.currentTime + 0.1; // small delay
    schedRunning = true;
    schedTimer = setInterval(schedTick, SCHED_INTERVAL);
  }

  function schedStop() {
    schedRunning = false;
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  }

  function schedTick() {
    if (!actx || !schedRunning) return;
    const beatDur = 60 / schedBPM;
    // Schedule all beats that fall within the lookahead window
    while (schedNextBeatTime < actx.currentTime + SCHED_AHEAD) {
      for (const song of schedSongs) {
        song.onBeat(actx, schedBeatIndex, schedNextBeatTime);
      }
      schedNextBeatTime += beatDur;
      schedBeatIndex++;
    }
  }

  function schedAddSong(song) {
    if (!schedSongs.includes(song)) schedSongs.push(song);
  }

  function schedRemoveSong(song) {
    schedSongs = schedSongs.filter(s => s !== song);
  }

  // ===========================================
  // SFX - one-shot sequences on dedicated tracks
  // ===========================================
  // SFX use the same Track/Instrument system but are triggered
  // manually (not by the scheduler). They play immediately.
  let sfxTracks = {};  // name → Track

  function buildSFX(ctx, dest) {
    // Pre-build a few reusable SFX tracks
    const defs = {
      eat:       { inst: 'sfxTone',  effects: [{ type: 'filter', params: { filterType: 'lowpass', freq: 3000, Q: 1 }}] },
      burn:      { inst: 'sfxNoise', effects: [{ type: 'filter', params: { filterType: 'bandpass', freq: 2000, Q: 0.5 }}] },
      candleOut: { inst: 'sfxSine',  effects: [] },
      death:     { inst: 'sfxSaw',   effects: [{ type: 'filter', params: { filterType: 'lowpass', freq: 800, Q: 2 }}] },
      lightning: { inst: 'sfxNoise', effects: [{ type: 'filter', params: { filterType: 'lowpass', freq: 500, Q: 0.5 }}] },
      pewBurn:   { inst: 'sfxNoise', effects: [{ type: 'filter', params: { filterType: 'bandpass', freq: 800, Q: 0.6 }}] },
    };
    for (const [name, def] of Object.entries(defs)) {
      const t = new Track('sfx_' + name, def.inst, def.effects, 1.0);
      t.build(ctx, dest);
      sfxTracks[name] = t;
    }
  }

  // Play a sequence of notes immediately on a named SFX track
  // seq: [["C4", durSec, vol], ...]  - durSec in seconds (not beats)
  function playSFXSequence(name, seq) {
    if (!enabled || !actx) return;
    const track = sfxTracks[name];
    if (!track) return;
    let t = actx.currentTime;
    for (const ev of seq) {
      const note = ev[0];
      const dur = ev[1];
      const vol = ev[2] !== undefined ? ev[2] : 0.07;
      if (note !== '-') {
        track.play(actx, note, t, dur, vol);
      }
      t += dur;
    }
  }

  // ===========================================
  // SFX DEFINITIONS (as note sequences)
  // ===========================================
  const SFX = {
    eat: () => {
      const startNote = corruption > 0.4 ? 'A4' : 'E4';
      playSFXSequence('eat', [
        [startNote, 0.06, 0.08],
        ['C3', 0.08, 0.06],
        ['G2', 0.10, 0.04],
      ]);
      // sizzle
      playSFXSequence('burn', [
        ['-', 0, 0], // noise doesn't use note, just triggers
        ['A4', 0.15, 0.04],
      ]);
    },
    burn: () => {
      playSFXSequence('burn', [['A4', 0.08, 0.03]]);
    },
    candleOut: () => {
      playSFXSequence('candleOut', [
        ['E4', 0.15, 0.02],
        ['C3', 0.3, 0.015],
        ['A2', 0.2, 0.008],
      ]);
    },
    death: () => {
      playSFXSequence('death', [
        ['E3', 0.3, 0.08],
        ['C3', 0.4, 0.07],
        ['A1', 0.8, 0.06],
      ]);
      // Extra growl layer
      playSFXSequence('burn', [['A2', 0.6, 0.04]]);
    },
    lightning: () => {
      playSFXSequence('lightning', [
        ['A5', 0.04, 0.07],   // crack
        ['-', 0.02, 0],
        ['A3', 0.5, 0.04],    // rumble
        ['A2', 0.4, 0.03],
      ]);
    },
    pewBurn: () => {
      playSFXSequence('pewBurn', [
        ['A4', 0.08, 0.05],   // snap
        ['-', 0.05, 0],
        ['A3', 0.3, 0.03],    // crackle
      ]);
    },
  };

  // ===========================================
  // DRONE - persistent ambient layer
  // ===========================================
  let droneNodes = [];

  function buildDrone(ctx, dest) {
    // Deep sub-bass beating
    [32.7, 33.1, 65.4].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.value = i < 2 ? 0.020 : 0.010;
      o.connect(g);
      g.connect(dest);
      o.start();
      droneNodes.push(o);
    });
    // Room ambience
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.value = 0.007;
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start();
    droneNodes.push(src);
  }

  // ===========================================
  // BELLS - periodic atmospheric bells
  // ===========================================
  let bellTimer = null;
  let bellTrack = null;

  function buildBells(ctx, dest) {
    bellTrack = new Track('bells', 'sfxSine', [
      { type: 'reverb', params: { decay: 3.0, mix: 0.5 } }
    ], 0.8);
    bellTrack.build(ctx, dest);
  }

  function scheduleBell() {
    if (!enabled || !actx || !bellTrack) return;
    const t = actx.currentTime;
    const fund = corruption > 0.5 ? 95 + Math.random() * 25 : 220 + Math.random() * 40;
    // Bell partials: each partial is a separate play
    const partials = [1, 2.2, 3.1, 4.6];
    for (const p of partials) {
      bellTrack.play(actx, fund * p, t, 3.5, 0.012 / p);
    }
    bellTimer = setTimeout(scheduleBell, 8000 + Math.random() * 16000);
  }

  // ===========================================
  // SONG BUILDING - Pure + Dark hymns
  // ===========================================
  let pureSong = null;
  let darkSong = null;

  // Shared reverb for the master bus
  let masterReverb = null;

  function buildSongs(ctx, dest) {
    // Master reverb (church acoustics)
    masterReverb = new Effect('reverb', { decay: 2.8, mix: 0.25 });
    masterReverb.build(ctx);
    masterReverb.output.connect(dest);
    const reverbDest = masterReverb.input;

    const BPM = 72; // quarter note = 72 BPM

    // ---- PURE SONG (C major hymn) ----
    pureSong = new Song('pure', BPM);
    pureSong.addTrack(new Track('bass',    'organBass',    [], 0.35));
    pureSong.addTrack(new Track('tenor',   'organTenor',   [], 0.25));
    pureSong.addTrack(new Track('alto',    'organAlto',    [], 0.22));
    pureSong.addTrack(new Track('soprano', 'organSoprano', [], 0.25));
    pureSong.addTrack(new Track('pedal',   'organPedal',   [], 0.30));
    pureSong.addTrack(new Track('choir',   'choir',        [], 0.00)); // starts silent

    // ---- DARK SONG (C minor / diminished) ----
    darkSong = new Song('dark', BPM);
    darkSong.addTrack(new Track('bass',    'organBass',
      [{ type: 'distortion', params: { amount: 0 } }], 0.35));
    darkSong.addTrack(new Track('tenor',   'organTenor',
      [{ type: 'distortion', params: { amount: 0 } },
       { type: 'tremolo',    params: { rate: 5, depth: 0 } }], 0.25));
    darkSong.addTrack(new Track('alto',    'organAlto',
      [{ type: 'distortion', params: { amount: 0 } },
       { type: 'tremolo',    params: { rate: 5.5, depth: 0 } }], 0.22));
    darkSong.addTrack(new Track('soprano', 'organSoprano',
      [{ type: 'distortion', params: { amount: 0 } },
       { type: 'tremolo',    params: { rate: 6, depth: 0 } }], 0.25));
    darkSong.addTrack(new Track('pedal',   'organPedal',
      [{ type: 'filter',     params: { filterType: 'lowpass', freq: 200, Q: 2 } }], 0.30));
    darkSong.addTrack(new Track('choir',   'choir',
      [{ type: 'filter',     params: { filterType: 'lowpass', freq: 1500, Q: 1 } }], 0.25));

    pureSong.build(ctx, reverbDest);
    darkSong.build(ctx, reverbDest);

    // Start dark song silent
    pureSong.setVolume(1.0);
    darkSong.setVolume(0.0);

    // ---- SEQUENCE DATA ----
    // Placeholder: simple C major / C minor hymn
    // Format: ["note", beats] or ["-", beats] for rest
    // This will be replaced with real Catholic hymn data later
    // For now: 16-bar structure, 4 beats per bar = 64 beats total

    // Pure sequences (C major - "Abide With Me" style)
    pureSong.setSequence('bass',    [["C2",4],["C2",4],["F2",4],["F2",4],["E2",4],["G2",4],["C2",8],["C2",4],["D2",4],["A1",4],["E2",4],["F2",4],["D2",4],["G2",4],["C2",4],["C2",8],]);
    pureSong.setSequence('tenor',   [["G2",4],["G2",4],["A2",4],["A2",4],["G2",4],["B2",4],["G2",8],["G2",4],["A2",4],["E2",4],["G2",4],["A2",4],["A2",4],["B2",4],["G2",4],["G2",8],]);
    pureSong.setSequence('alto',    [["E3",4],["E3",4],["C3",2],["F3",2],["C3",4],["C3",4],["D3",4],["E3",8],["E3",4],["D3",4],["A2",4],["B2",4],["C3",4],["A2",4],["D3",4],["G3",4],["E3",8],]);
    pureSong.setSequence('soprano', [["C4",4],["B3",2],["C4",2],["A3",4],["A3",2],["G3",2],["G3",4],["G3",4],["C4",8],["C4",4],["D4",4],["E4",4],["E4",4],["D4",4],["C4",4],["B3",4],["C4",8],]);
    pureSong.setSequence('pedal',   [["C1",8],["F1",8],["C1",4],["G1",4],["C1",8],["C1",8],["A0",4],["E1",4],["F1",4],["D1",4],["G1",4],["C1",4],["C1",8],]);
    pureSong.setSequence('choir',   [["C4",4],["B3",2],["C4",2],["A3",4],["A3",2],["G3",2],["G3",4],["G3",4],["C4",8],["C4",4],["D4",4],["E4",4],["E4",4],["D4",4],["C4",4],["B3",4],["C4",8],]);

    // Dark sequences (C minor / diminished - same rhythm, minor intervals)
    darkSong.setSequence('bass',    [["C2",4],["C2",4],["F2",4],["F2",4],["Eb2",4],["G2",4],["C2",8],["C2",4],["D2",4],["Ab1",4],["Eb2",4],["F2",4],["D2",4],["G2",4],["C2",4],["C2",8],]);
    darkSong.setSequence('tenor',   [["G2",4],["G2",4],["Ab2",4],["Ab2",4],["G2",4],["Bb2",4],["G2",8],["G2",4],["Ab2",4],["Eb2",4],["G2",4],["Ab2",4],["Ab2",4],["Bb2",4],["G2",4],["G2",8],]);
    darkSong.setSequence('alto',    [["Eb3",4],["Eb3",4],["C3",2],["F3",2],["C3",4],["C3",4],["Db3",4],["Eb3",8],["Eb3",4],["Db3",4],["Ab2",4],["Bb2",4],["C3",4],["Ab2",4],["Db3",4],["G3",4],["Eb3",8],]);
    darkSong.setSequence('soprano', [["C4",4],["Bb3",2],["C4",2],["Ab3",4],["Ab3",2],["G3",2],["G3",4],["G3",4],["C4",8],["C4",4],["Db4",4],["Eb4",4],["Eb4",4],["Db4",4],["C4",4],["Bb3",4],["C4",8],]);
    darkSong.setSequence('pedal',   [["C1",8],["F1",8],["C1",4],["G1",4],["C1",8],["C1",8],["Ab0",4],["Eb1",4],["F1",4],["D1",4],["G1",4],["C1",4],["C1",8],]);
    darkSong.setSequence('choir',   [["C4",4],["Bb3",2],["C4",2],["Ab3",4],["Ab3",2],["G3",2],["G3",4],["G3",4],["C4",8],["C4",4],["Db4",4],["Eb4",4],["Eb4",4],["Db4",4],["C4",4],["Bb3",4],["C4",8],]);

    schedAddSong(pureSong);
    schedAddSong(darkSong);
    schedStart(BPM);
  }

  // ===========================================
  // CORRUPTION - crossfade + effect modulation
  // ===========================================
  function applyCorruption() {
    if (!pureSong || !darkSong) return;

    // Crossfade songs
    pureSong.setVolume(1 - corruption);
    darkSong.setVolume(corruption);

    // Choir fades in with corruption (on both songs)
    const choirPure = pureSong.tracks['choir'];
    const choirDark = darkSong.tracks['choir'];
    if (choirPure) choirPure.setVolume(corruption * 0.20);
    if (choirDark) choirDark.setVolume(corruption * 0.25);

    // Modulate dark song effects
    const dist = corruption * 80;
    const tremDepth = corruption * 0.3;
    for (const t of Object.values(darkSong.tracks)) {
      t.updateEffects({
        distortion: { amount: dist },
        tremolo:    { depth: tremDepth },
      });
    }

    // Reverb wet increases with corruption
    if (masterReverb) {
      masterReverb.update({ mix: 0.25 + corruption * 0.25 });
    }
  }

  // ===========================================
  // PUBLIC API (backwards-compatible)
  // ===========================================
  function init() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.gain.value = 0.38;
    master.connect(actx.destination);
  }

  function resume() {
    if (actx?.state === 'suspended') actx.resume();
  }

  function setCorruption(v) {
    corruption = Math.max(0, Math.min(1, v));
    applyCorruption();
  }

  function setEnabled(v) {
    enabled = v;
    if (!v) {
      schedStop();
      for (const n of droneNodes) { try { n.stop(); } catch (e) {} }
      droneNodes = [];
      if (bellTimer) { clearTimeout(bellTimer); bellTimer = null; }
      started = false;
    } else if (!started) {
      init();
      resume();
      started = true;
      buildDrone(actx, master);
      buildSFX(actx, master);
      buildBells(actx, master);
      buildSongs(actx, master);
      scheduleBell();
      applyCorruption();
    }
  }

  function toggle() {
    setEnabled(!enabled);
    return enabled;
  }

  // SFX public wrappers
  function playEat()       { if (enabled) SFX.eat(); }
  function playBurn()      { if (enabled) SFX.burn(); }
  function playCandleOut() { if (enabled) SFX.candleOut(); }
  function playDeath()     { if (enabled) SFX.death(); }
  function playLightning() { if (enabled) SFX.lightning(); }
  function playPewBurn()   { if (enabled) SFX.pewBurn(); }

  return {
    init, resume, setEnabled, toggle, setCorruption,
    playEat, playBurn, playCandleOut, playDeath, playLightning, playPewBurn,
    isEnabled: () => enabled,
    // Expose internals for future use
    getContext: () => actx,
    getSong: (name) => name === 'pure' ? pureSong : name === 'dark' ? darkSong : null,
  };
})();
