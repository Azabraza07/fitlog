import { Injectable } from '@angular/core';

/**
 * Держит экран включённым во время тренировки (Screen Wake Lock API,
 * iOS Safari 16.4+). При сворачивании браузер сам снимает блокировку —
 * возвращаем её, когда вкладка снова видима.
 */
@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (this.wanted && document.visibilityState === 'visible') {
        void this.request();
      }
    });
  }

  async acquire(): Promise<void> {
    this.wanted = true;
    await this.request();
  }

  release(): void {
    this.wanted = false;
    void this.sentinel?.release();
    this.sentinel = null;
  }

  private async request(): Promise<void> {
    try {
      this.sentinel = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // нет поддержки или энергосбережение — просто работаем без блокировки
    }
  }
}
