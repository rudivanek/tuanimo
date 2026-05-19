export type SoundType = 'response' | 'journal-suggestion' | 'journal-saved';

class AudioManager {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private lastPlayedAt: Record<SoundType, number> = {
    'response': 0,
    'journal-suggestion': 0,
    'journal-saved': 0,
  };
  private readonly cooldownMs = 2500;

  constructor() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.unlock();
      window.removeEventListener('pointerdown', unlock, { capture: true });
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
  }

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (Ctx) this.ctx = new Ctx();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  unlock() {
    const ctx = this.getContext();
    if (!ctx || this.unlocked) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => { this.unlocked = true; });
    } else {
      this.unlocked = true;
    }
  }

  private playTone(freq: number, startTime: number, duration: number, gainPeak = 0.18) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  private _play(type: SoundType) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    if (type === 'response') {
      this.playTone(880, t, 0.45, 0.18);
    } else if (type === 'journal-suggestion') {
      this.playTone(880, t, 0.35, 0.18);
      this.playTone(1109, t + 0.28, 0.42, 0.16);
    } else if (type === 'journal-saved') {
      this.playTone(523, t, 0.32, 0.16);
      this.playTone(659, t + 0.18, 0.32, 0.16);
      this.playTone(784, t + 0.36, 0.44, 0.16);
    }
  }

  play(type: SoundType) {
    if (!this.unlocked) return;
    if (document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - this.lastPlayedAt[type] < this.cooldownMs) return;
    this.lastPlayedAt[type] = now;
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => this._play(type));
    } else {
      this._play(type);
    }
  }
}

export const audioManager = new AudioManager();
