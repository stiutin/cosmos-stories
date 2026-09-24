import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpdatePrompt } from './components/update-prompt/update-prompt';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UpdatePrompt],
  template: '<router-outlet /><app-update-prompt />',
  styles: ':host { display: block; height: 100%; }',
})
export class App {}
