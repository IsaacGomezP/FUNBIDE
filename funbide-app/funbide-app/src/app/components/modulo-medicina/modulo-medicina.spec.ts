import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuloMedicina } from './modulo-medicina';

describe('ModuloMedicina', () => {
  let component: ModuloMedicina;
  let fixture: ComponentFixture<ModuloMedicina>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuloMedicina],
    }).compileComponents();

    fixture = TestBed.createComponent(ModuloMedicina);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
