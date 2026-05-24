import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuloGenerarTurnoComponent } from './modulo-generarTurno';

describe('ModuloGenerarTurnoComponent', () => {
  let component: ModuloGenerarTurnoComponent;
  let fixture: ComponentFixture<ModuloGenerarTurnoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuloGenerarTurnoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ModuloGenerarTurnoComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
