import { Component, output } from '@angular/core';

/** Нижняя шторка: рендерит проецируемый контент, закрывается по фону */
@Component({
  selector: 'app-sheet',
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <div class="sheet" role="dialog">
      <div class="grip" aria-hidden="true"></div>
      <ng-content />
    </div>
  `,
  styleUrl: './sheet.scss',
})
export class Sheet {
  readonly closed = output<void>();
}
