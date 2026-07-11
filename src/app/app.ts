import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';
import { RestTimer } from './shared/rest-timer/rest-timer';
import { TimerService } from './core/timer.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TuiRoot, RestTimer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly timer = inject(TimerService);

  protected readonly today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });

  protected readonly nav = [
    { path: '/workout', index: '01', label: 'Тренировка' },
    { path: '/history', index: '02', label: 'История' },
    { path: '/progress', index: '03', label: 'Прогресс' },
    { path: '/nutrition', index: '04', label: 'Питание' },
  ];
}
