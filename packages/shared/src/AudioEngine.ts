/**
 * Robust HTML5 Web Audio SIP/PBX Sound Effects Synthesizer
 * Works completely offline by generating pure mathematical wave frequencies (DTMF, Ringers)
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private activeNodes: { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode }[] = [];
  private ringerInterval: ReturnType<typeof setInterval> | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  private playDualTones(f1: number, f2: number, duration: number, gainVal: number = 0.15) {
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(f1, this.ctx.currentTime);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(f2, this.ctx.currentTime);

      gainNode.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc1.start();
      osc2.start();

      osc1.stop(this.ctx.currentTime + duration);
      osc2.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Synthesizer play dual tones failed:", e);
    }
  }

  public playDTMF(char: string) {
    const dtmfFreqs: Record<string, [number, number]> = {
      "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
      "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
      "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
      "*": [941, 1209], "0": [941, 1336], "#": [941, 1477]
    };

    const freqs = dtmfFreqs[char];
    if (freqs) {
      this.playDualTones(freqs[0], freqs[1], 0.12, 0.1);
    }
  }

  public startDialTone() {
    this.initCtx();
    if (!this.ctx) return;
    this.stopAll();

    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc1.frequency.setValueAtTime(350, this.ctx.currentTime);
      osc2.frequency.setValueAtTime(440, this.ctx.currentTime);
      gainNode.gain.setValueAtTime(0.04, this.ctx.currentTime);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc1.start();
      osc2.start();

      this.activeNodes.push({ osc1, osc2, gain: gainNode });
    } catch (e) {
      console.warn("Start dialtone failed:", e);
    }
  }

  public startRingbackTone() {
    this.initCtx();
    if (!this.ctx) return;
    this.stopAll();

    const playCycle = () => {
      if (!this.ctx) return;
      try {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc1.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc2.frequency.setValueAtTime(480, this.ctx.currentTime);

        gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.06, this.ctx.currentTime + 1.9);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.0);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc1.start();
        osc2.start();

        osc1.stop(this.ctx.currentTime + 2.0);
        osc2.stop(this.ctx.currentTime + 2.0);
      } catch (e) {
        console.warn("Ringback cycle failed:", e);
      }
    };

    playCycle();
    this.ringerInterval = setInterval(playCycle, 6000);
  }

  public startIncomingRinger() {
    this.initCtx();
    if (!this.ctx) return;
    this.stopAll();

    const playRing = () => {
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.frequency.setValueAtTime(853, now);
        osc2.frequency.setValueAtTime(960, now);
        gain.gain.setValueAtTime(0, now);

        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.45);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.8);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.85);
        gain.gain.linearRampToValueAtTime(0.001, now + 1.3);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(now + 1.4);
        osc2.stop(now + 1.4);
      } catch (e) {
        console.warn("Ringer cycle failed:", e);
      }
    };

    playRing();
    this.ringerInterval = setInterval(playRing, 3500);
  }

  public startBusyTone() {
    this.initCtx();
    if (!this.ctx) return;
    this.stopAll();

    const playBusy = () => {
      if (!this.ctx) return;
      try {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc1.frequency.setValueAtTime(480, this.ctx.currentTime);
        osc2.frequency.setValueAtTime(620, this.ctx.currentTime);

        gainNode.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 0.5);
        osc2.stop(this.ctx.currentTime + 0.5);
      } catch (e) {
        console.warn("Busy cycle failed:", e);
      }
    };

    playBusy();
    this.ringerInterval = setInterval(playBusy, 1000);
  }

  public playCallConnect() {
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.frequency.setValueAtTime(freq, now + idx * 0.08);
        g.gain.setValueAtTime(0.06, now + idx * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now + idx * 0.08);
        o.stop(now + idx * 0.08 + 0.3);
      });
    } catch (e) {
      console.warn("Connect sound failed:", e);
    }
  }

  public playHangupTone() {
    this.initCtx();
    if (!this.ctx) return;
    this.stopAll();

    try {
      const now = this.ctx.currentTime;
      const chirps = [
        { offset: 0, startHz: 480, endHz: 300, gain: 0.14, duration: 0.14 },
        { offset: 0.26, startHz: 380, endHz: 220, gain: 0.12, duration: 0.14 },
      ];

      for (const chirp of chirps) {
        if (!this.ctx) return;
        const t = now + chirp.offset;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        o.frequency.setValueAtTime(chirp.startHz, t);
        o.frequency.linearRampToValueAtTime(chirp.endHz, t + chirp.duration);

        g.gain.setValueAtTime(chirp.gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + chirp.duration + 0.02);

        o.connect(g);
        g.connect(this.ctx.destination);

        o.start(t);
        o.stop(t + chirp.duration + 0.04);
      }
    } catch (e) {
      console.warn("Hangup sound failed:", e);
    }
  }

  public playMessageReceipt() {
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      o.frequency.setValueAtTime(587.33, now);
      o.frequency.setValueAtTime(880, now + 0.1);

      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.06, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(now + 0.35);
    } catch (e) {
      console.warn("Message chime failed:", e);
    }
  }

  public stopAll() {
    if (this.ringerInterval) {
      clearInterval(this.ringerInterval);
      this.ringerInterval = null;
    }

    this.activeNodes.forEach(({ osc1, osc2, gain }) => {
      try {
        osc1.stop();
        osc2.stop();
        osc1.disconnect();
        osc2.disconnect();
        gain.disconnect();
      } catch {
        // already stopped
      }
    });
    this.activeNodes = [];
  }
}

export const telephonyAudio = new AudioEngine();
export default telephonyAudio;
