import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';

import {routes} from './app.routes';

describe('App routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    });
  });

  it('renders the home page with the carousel and the NASA credit', async () => {
    const harness = await RouterTestingHarness.create('/');
    const element = harness.routeNativeElement;

    expect(element?.querySelector('app-carousel')).not.toBeNull();
    expect(element?.querySelector('.app__footer')?.textContent).toContain('not affiliated');
  });

  it('redirects unknown paths home', async () => {
    await RouterTestingHarness.create('/nowhere');
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
