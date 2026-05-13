import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModuloFarmaciaComponent } from './modulo-farmacia';

describe('ModuloFarmaciaComponent', () => {
  let component: ModuloFarmaciaComponent;
  let fixture: ComponentFixture<ModuloFarmaciaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuloFarmaciaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ModuloFarmaciaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});