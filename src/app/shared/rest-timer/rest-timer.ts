import { Component, inject } from '@angular/core';
import { TimerService } from '../../core/timer.service';

@Component({
  selector: 'app-rest-timer',
  templateUrl: './rest-timer.html',
  styleUrl: './rest-timer.scss',
})
export class RestTimer {
  protected readonly timer = inject(TimerService);
}
