import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TagInputComponent } from '../tag-input/tag-input.component';
import { KeyValueEditorComponent } from '../key-value-editor/key-value-editor.component';
import { ModelConstantsService } from '../../../services/model-constants.service';
import { NotificationService } from '../../../services/notification.service';

type RequirementValue = number | string | boolean | number[] | string[];

export interface ModelRequirementsConfig {
  /**
   * Enable min_steps field for image generation models
   */
  enableMinSteps?: boolean;
  /**
   * Enable max_steps field for image generation models
   */
  enableMaxSteps?: boolean;
  /**
   * Enable cfg_scale field for image generation models
   */
  enableCfgScale?: boolean;
  /**
   * Enable samplers field for image generation models
   */
  enableSamplers?: boolean;
  /**
   * Enable schedulers field for image generation models
   */
  enableSchedulers?: boolean;
}

@Component({
  selector: 'app-model-requirements-editor',
  imports: [FormsModule, TagInputComponent, KeyValueEditorComponent],
  templateUrl: './model-requirements-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRequirementsEditorComponent {
  readonly label = input<string>('Requirements');
  readonly values = input<Record<string, RequirementValue>>({});
  readonly config = input<ModelRequirementsConfig>({});
  readonly valuesChange = output<Record<string, RequirementValue>>();

  private readonly constants = inject(ModelConstantsService);
  private readonly notification = inject(NotificationService);

  // Structured field values extracted from the requirements object
  readonly minSteps = signal<number | null>(null);
  readonly maxSteps = signal<number | null>(null);
  readonly cfgScale = signal<number | null>(null);
  readonly samplers = signal<string[]>([]);
  readonly schedulers = signal<string[]>([]);

  // Custom key-value pairs (anything not in structured fields)
  readonly customFields = signal<Record<string, RequirementValue>>({});

  // Constants for autocomplete
  readonly knownSamplers = this.constants.getKnownSamplers();
  readonly knownSchedulers = this.constants.getKnownSchedulers();

  // Computed config flags with defaults
  readonly showMinSteps = computed(() => this.config().enableMinSteps ?? true);
  readonly showMaxSteps = computed(() => this.config().enableMaxSteps ?? true);
  readonly showCfgScale = computed(() => this.config().enableCfgScale ?? true);
  readonly showSamplers = computed(() => this.config().enableSamplers ?? true);
  readonly showSchedulers = computed(() => this.config().enableSchedulers ?? true);

  constructor() {
    // Initialize structured fields from input values
    effect(() => {
      const vals = this.values();
      this.extractStructuredFields(vals);
    });
  }

  private extractStructuredFields(vals: Record<string, RequirementValue>): void {
    const custom: Record<string, RequirementValue> = {};

    // Extract structured fields
    for (const [key, value] of Object.entries(vals)) {
      if (key === 'min_steps' && typeof value === 'number') {
        this.minSteps.set(value);
      } else if (key === 'max_steps' && typeof value === 'number') {
        this.maxSteps.set(value);
      } else if (key === 'cfg_scale' && typeof value === 'number') {
        this.cfgScale.set(value);
      } else if (key === 'samplers' && Array.isArray(value)) {
        this.samplers.set(value.filter((v): v is string => typeof v === 'string'));
      } else if (key === 'schedulers' && Array.isArray(value)) {
        this.schedulers.set(value.filter((v): v is string => typeof v === 'string'));
      } else {
        // Everything else goes to custom fields
        custom[key] = value;
      }
    }

    this.customFields.set(custom);
  }

  private emitCombinedValues(): void {
    const combined: Record<string, RequirementValue> = {};

    // Add structured fields if enabled and have values
    if (this.showMinSteps() && this.minSteps() !== null) {
      combined['min_steps'] = this.minSteps()!;
    }
    if (this.showMaxSteps() && this.maxSteps() !== null) {
      combined['max_steps'] = this.maxSteps()!;
    }
    if (this.showCfgScale() && this.cfgScale() !== null) {
      combined['cfg_scale'] = this.cfgScale()!;
    }
    if (this.showSamplers() && this.samplers().length > 0) {
      combined['samplers'] = this.samplers();
    }
    if (this.showSchedulers() && this.schedulers().length > 0) {
      combined['schedulers'] = this.schedulers();
    }

    // Add custom fields
    Object.assign(combined, this.customFields());

    this.valuesChange.emit(combined);
  }

  updateMinSteps(value: string): void {
    const num = value.trim() === '' ? null : parseFloat(value);
    if (num !== null && (isNaN(num) || num < 0)) {
      this.notification.error('Min steps must be a positive number');
      return;
    }
    this.minSteps.set(num);
    this.validateSteps();
    this.emitCombinedValues();
  }

  updateMaxSteps(value: string): void {
    const num = value.trim() === '' ? null : parseFloat(value);
    if (num !== null && (isNaN(num) || num < 0)) {
      this.notification.error('Max steps must be a positive number');
      return;
    }
    this.maxSteps.set(num);
    this.validateSteps();
    this.emitCombinedValues();
  }

  updateCfgScale(value: string): void {
    const num = value.trim() === '' ? null : parseFloat(value);
    if (num !== null && (isNaN(num) || num <= 0)) {
      this.notification.error('CFG scale must be a positive number');
      return;
    }
    this.cfgScale.set(num);
    this.emitCombinedValues();
  }

  updateSamplers(value: string[]): void {
    this.samplers.set(value);
    this.emitCombinedValues();
  }

  updateSchedulers(value: string[]): void {
    this.schedulers.set(value);
    this.emitCombinedValues();
  }

  updateCustomFields(value: Record<string, RequirementValue>): void {
    // Prevent users from adding structured field names as custom fields
    const reserved = ['min_steps', 'max_steps', 'cfg_scale', 'samplers', 'schedulers'];
    const hasReservedKey = Object.keys(value).some((key) => reserved.includes(key));

    if (hasReservedKey) {
      this.notification.error(
        'Cannot use reserved field names (min_steps, max_steps, cfg_scale, samplers, schedulers) in custom fields',
      );
      // Remove reserved keys from the value
      const filtered: Record<string, RequirementValue> = {};
      for (const [key, val] of Object.entries(value)) {
        if (!reserved.includes(key)) {
          filtered[key] = val;
        }
      }
      this.customFields.set(filtered);
    } else {
      this.customFields.set(value);
    }

    this.emitCombinedValues();
  }

  private validateSteps(): void {
    const min = this.minSteps();
    const max = this.maxSteps();

    if (min !== null && max !== null && min >= max) {
      this.notification.error('Min steps must be less than max steps');
    }
  }
}
