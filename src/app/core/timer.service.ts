import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TimerService {
  readonly total = signal(0);
  readonly left = signal(0);
  readonly running = signal(false);

  readonly progress = computed(() => (this.total() ? 1 - this.left() / this.total() : 0));
  readonly display = computed(() => {
    const left = this.left();
    const m = Math.floor(left / 60);
    const s = String(left % 60).padStart(2, '0');
    return `${m}:${s}`;
  });

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;

  /** Вызывать из обработчика клика — iOS разрешает звук только после жеста */
  unlockAudio(): void {
    this.audioCtx ??= new AudioContext();
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
  }

  start(seconds: number): void {
    this.stopInterval();
    this.total.set(seconds);
    this.left.set(seconds);
    this.running.set(true);
    this.intervalId = setInterval(() => {
      const next = this.left() - 1;
      if (next <= 0) {
        this.stop();
        this.beep();
        return;
      }
      this.left.set(next);
    }, 1000);
  }

  add(delta: number): void {
    const next = Math.max(1, this.left() + delta);
    this.left.set(next);
    this.total.update((t) => Math.max(t, next));
  }

  stop(): void {
    this.stopInterval();
    this.running.set(false);
  }

  private stopInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private beep(): void {
    const ctx = this.audioCtx;
    if (!ctx) return;
    [0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      const t = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }
}
