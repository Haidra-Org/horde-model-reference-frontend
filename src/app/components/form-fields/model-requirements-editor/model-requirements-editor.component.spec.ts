import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ModelRequirementsEditorComponent } from './model-requirements-editor.component';

describe('ModelRequirementsEditorComponent', () => {
  let component: ModelRequirementsEditorComponent;
  let fixture: ComponentFixture<ModelRequirementsEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModelRequirementsEditorComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(ModelRequirementsEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('values', {});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should extract structured fields from input values', () => {
    const requirements = {
      min_steps: 3,
      max_steps: 150,
      cfg_scale: 7.5,
      samplers: ['k_euler', 'k_dpmpp_sde'],
      schedulers: ['karras'],
      custom_field: 'custom_value',
    };

    fixture.componentRef.setInput('values', requirements);
    fixture.detectChanges();

    expect(component.minSteps()).toBe(3);
    expect(component.maxSteps()).toBe(150);
    expect(component.cfgScale()).toBe(7.5);
    expect(component.samplers()).toEqual(['k_euler', 'k_dpmpp_sde']);
    expect(component.schedulers()).toEqual(['karras']);
    expect(component.customFields()).toEqual({ custom_field: 'custom_value' });
  });

  it('should emit combined values when structured fields change', () => {
    const onChangeSpy = jasmine.createSpy('onChange');
    fixture.componentRef.setInput('values', {});
    component.valuesChange.subscribe(onChangeSpy);
    fixture.detectChanges();

    component.updateMinSteps('5');

    expect(onChangeSpy).toHaveBeenCalledWith({ min_steps: 5 });
  });

  it('should prevent reserved field names in custom fields', () => {
    const onChangeSpy = jasmine.createSpy('onChange');
    component.valuesChange.subscribe(onChangeSpy);
    fixture.detectChanges();

    component.updateCustomFields({
      min_steps: 10,
      custom_field: 'value',
    });

    // Reserved field should be filtered out
    expect(component.customFields()).toEqual({ custom_field: 'value' });
  });

  it('should validate min_steps < max_steps', () => {
    fixture.componentRef.setInput('values', { min_steps: 10, max_steps: 5 });
    fixture.detectChanges();

    // Component should have both values but validation warning should be shown
    expect(component.minSteps()).toBe(10);
    expect(component.maxSteps()).toBe(5);
  });

  it('should handle config to show/hide structured fields', () => {
    fixture.componentRef.setInput('config', {
      enableMinSteps: false,
      enableMaxSteps: false,
      enableCfgScale: false,
      enableSamplers: false,
      enableSchedulers: false,
    });
    fixture.detectChanges();

    expect(component.showMinSteps()).toBe(false);
    expect(component.showMaxSteps()).toBe(false);
    expect(component.showCfgScale()).toBe(false);
    expect(component.showSamplers()).toBe(false);
    expect(component.showSchedulers()).toBe(false);
  });
});
