import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CommonFieldsComponent, CommonFieldsData } from './common-fields.component';
import { ModelReferenceApiService } from '../../../services/model-reference-api.service';
import { ModelConstantsService } from '../../../services/model-constants.service';
import { LegacyRecordUnion } from '../../../models/api.models';
import { FormFieldConfig, FormFieldGroup } from '../../../models/form-field-config';

/**
 * Helper function to extract style field from field groups
 * This provides type-safe access to the autocomplete suggestions
 */
function getStyleFieldSuggestions(
  fieldGroups: (FormFieldConfig | FormFieldGroup)[],
): readonly string[] {
  const contentClassificationGroup = fieldGroups[1] as FormFieldGroup;
  const styleField = contentClassificationGroup.fields.find((f) => f.id === 'style');
  if (!styleField || styleField.type !== 'autocomplete') {
    throw new Error('Style field not found or wrong type');
  }
  return styleField.suggestions || [];
}

/**
 * Helper to wait for async operations in zoneless tests
 */
async function waitForAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('CommonFieldsComponent - Style Autocomplete Per Category', () => {
  let component: CommonFieldsComponent;
  let fixture: ComponentFixture<CommonFieldsComponent>;
  let apiService: jasmine.SpyObj<ModelReferenceApiService>;

  // Mock data for different categories
  const imageGenerationModels: LegacyRecordUnion[] = [
    {
      name: 'model1',
      style: 'anime',
      description: 'Test model 1',
      nsfw: false,
    } as LegacyRecordUnion,
    {
      name: 'model2',
      style: 'realistic',
      description: 'Test model 2',
      nsfw: false,
    } as LegacyRecordUnion,
    {
      name: 'model3',
      style: 'anime',
      description: 'Test model 3',
      nsfw: false,
    } as LegacyRecordUnion,
    {
      name: 'model4',
      style: 'furry',
      description: 'Test model 4',
      nsfw: false,
    } as LegacyRecordUnion,
    {
      name: 'model5',
      style: 'cyberpunk', // Custom style not in predefined list
      description: 'Test model 5',
      nsfw: false,
    } as LegacyRecordUnion,
  ];

  const textGenerationModels: LegacyRecordUnion[] = [
    {
      name: 'text-model1',
      style: 'academic',
      description: 'Academic writing model',
    } as LegacyRecordUnion,
    {
      name: 'text-model2',
      style: 'creative',
      description: 'Creative writing model',
    } as LegacyRecordUnion,
    {
      name: 'text-model3',
      style: 'technical',
      description: 'Technical writing model',
    } as LegacyRecordUnion,
  ];

  const commonData: CommonFieldsData = {
    description: 'Test Description',
    nsfw: false,
  };

  beforeEach(() => {
    const apiServiceSpy = jasmine.createSpyObj('ModelReferenceApiService', [
      'getLegacyModelsAsArray',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ModelReferenceApiService, useValue: apiServiceSpy },
        ModelConstantsService,
      ],
    });

    apiService = TestBed.inject(
      ModelReferenceApiService,
    ) as jasmine.SpyObj<ModelReferenceApiService>;
  });

  describe('Image Generation Category', () => {
    beforeEach(() => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(imageGenerationModels));

      fixture = TestBed.createComponent(CommonFieldsComponent);
      fixture.componentRef.setInput('data', commonData);
      fixture.componentRef.setInput('category', 'image_generation');

      component = fixture.componentInstance;
    });

    it('should create component', () => {
      expect(component).toBeTruthy();
    });

    it('should fetch models when component initializes with image_generation category', async () => {
      fixture.detectChanges();
      await waitForAsync();

      expect(apiService.getLegacyModelsAsArray).toHaveBeenCalledWith('image_generation');
    });

    it('should populate style autocomplete with unique styles from image_generation models', async () => {
      fixture.detectChanges();
      await waitForAsync();

      const fieldGroups = component.fieldGroups();
      const suggestions = getStyleFieldSuggestions(fieldGroups);

      // Should contain styles from models (using the casing from the mock data)
      expect(suggestions).toContain('anime');
      expect(suggestions).toContain('realistic');
      expect(suggestions).toContain('furry');
      expect(suggestions).toContain('cyberpunk');

      // Should be unique (anime appears twice in models but once in suggestions)
      const animeCount = suggestions.filter((s) => s.toLowerCase() === 'anime').length;
      expect(animeCount).toBe(1);
    });
  });

  describe('Text Generation Category', () => {
    beforeEach(() => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(textGenerationModels));

      fixture = TestBed.createComponent(CommonFieldsComponent);
      fixture.componentRef.setInput('data', commonData);
      fixture.componentRef.setInput('category', 'text_generation');

      component = fixture.componentInstance;
    });

    it('should fetch models when component initializes with text_generation category', async () => {
      fixture.detectChanges();
      await waitForAsync();

      expect(apiService.getLegacyModelsAsArray).toHaveBeenCalledWith('text_generation');
    });

    it('should populate style autocomplete with styles specific to text_generation', async () => {
      fixture.detectChanges();
      await waitForAsync();

      const fieldGroups = component.fieldGroups();
      const suggestions = getStyleFieldSuggestions(fieldGroups);

      // Should contain text generation specific styles
      expect(suggestions).toContain('academic');
      expect(suggestions).toContain('creative');
      expect(suggestions).toContain('technical');

      // Should NOT contain image-specific styles
      expect(suggestions).not.toContain('cyberpunk');
    });
  });

  describe('Error Handling', () => {
    it('should fall back to empty suggestions when API fails', async () => {
      apiService.getLegacyModelsAsArray.and.returnValue(throwError(() => new Error('API Error')));

      fixture = TestBed.createComponent(CommonFieldsComponent);
      fixture.componentRef.setInput('data', commonData);
      fixture.componentRef.setInput('category', 'image_generation');
      component = fixture.componentInstance;

      fixture.detectChanges();
      await waitForAsync();

      const fieldGroups = component.fieldGroups();
      const suggestions = getStyleFieldSuggestions(fieldGroups);

      // Should have empty suggestions on API error
      expect(suggestions).toEqual([]);
    });
  });
});
