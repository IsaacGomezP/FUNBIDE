import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuloCajaComponent } from './modulo-caja';

describe('ModuloCajaComponent', () => {
  let component: ModuloCajaComponent;
  let fixture: ComponentFixture<ModuloCajaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuloCajaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ModuloCajaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
