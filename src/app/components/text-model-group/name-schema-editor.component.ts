import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HordeBadgeComponent } from '@haidra/design-system/badge';
import { HordeButtonComponent } from '@haidra/design-system/button';
import { GroupNameSchemaUpdateRequest, NameFormatInfo } from '../../api-client';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';

const AVAILABLE_PARTS = ['size', 'variant', 'version', 'quant'] as const;
const SEPARATOR_OPTIONS = ['-', '_', '.'] as const;

@Component({
  selector: 'app-name-schema-editor',
  imports: [FormsModule, HordeBadgeComponent, HordeButtonComponent],
  templateUrl: './name-schema-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NameSchemaEditorComponent {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly groupName = input.required<string>();
  readonly nameFormat = input.required<NameFormatInfo>();
  readonly isCustom = input(false);
  readonly writable = input(false);

  readonly schemaChanged = output<void>();

  readonly editing = signal(false);
  readonly saving = signal(false);

  readonly editSeparator = signal('-');
  readonly editPartOrder = signal<string[]>([]);
  readonly editAuthorIncluded = signal(false);
  readonly editCommonAuthor = signal<string | null>(null);
  readonly editTemplate = signal<string | null>(null);
  readonly editExtraParts = signal<string[]>([]);
  readonly newExtraPart = signal('');

  readonly separatorOptions = SEPARATOR_OPTIONS;
  readonly availableParts = AVAILABLE_PARTS;

  readonly isDirty = computed(() => {
    if (!this.editing()) return false;
    const current = this.nameFormat();
    return (
      this.editSeparator() !== current.separator ||
      JSON.stringify(this.editPartOrder()) !== JSON.stringify(current.part_order) ||
      this.editAuthorIncluded() !== current.author_included ||
      (this.editCommonAuthor() ?? null) !== (current.common_author ?? null) ||
      (this.editTemplate() ?? null) !== (current.template ?? null) ||
      JSON.stringify(this.editExtraParts()) !== JSON.stringify(current.extra_parts ?? [])
    );
  });

  readonly previewTemplate = computed(() => {
    const sep = this.editing() ? this.editSeparator() : this.nameFormat().separator;
    const parts = this.editing() ? this.editPartOrder() : this.nameFormat().part_order;
    const author = this.editing() ? this.editCommonAuthor() : this.nameFormat().common_author;

    const prefix = author ? `${author}/` : '';
    const body = ['{base}', ...parts.map((p) => `{${p}}`)].join(sep);
    return prefix + body;
  });

  startEditing(): void {
    const current = this.nameFormat();
    this.editSeparator.set(current.separator);
    this.editPartOrder.set([...current.part_order]);
    this.editAuthorIncluded.set(current.author_included);
    this.editCommonAuthor.set(current.common_author ?? null);
    this.editTemplate.set(current.template ?? null);
    this.editExtraParts.set([...(current.extra_parts ?? [])]);
    this.newExtraPart.set('');
    this.editing.set(true);
  }

  cancelEditing(): void {
    this.editing.set(false);
  }

  movePartUp(index: number): void {
    if (index <= 0) return;
    this.editPartOrder.update((parts) => {
      const next = [...parts];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  movePartDown(index: number): void {
    this.editPartOrder.update((parts) => {
      if (index >= parts.length - 1) return parts;
      const next = [...parts];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  saveSchema(): void {
    if (!this.isDirty() || this.saving()) return;

    this.saving.set(true);
    const request: GroupNameSchemaUpdateRequest = {
      separator: this.editSeparator(),
      part_order: this.editPartOrder(),
      author_included: this.editAuthorIncluded(),
      common_author: this.editCommonAuthor(),
      template: this.editTemplate(),
      extra_parts: this.editExtraParts(),
    };

    this.api
      .updateGroupNameSchema(this.groupName(), request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success('Name schema saved');
          this.editing.set(false);
          this.saving.set(false);
          this.schemaChanged.emit();
        },
        error: (error: Error) => {
          this.notification.error(error.message);
          this.saving.set(false);
        },
      });
  }

  revertToInferred(): void {
    if (this.saving()) return;

    this.saving.set(true);
    this.api
      .deleteGroupNameSchema(this.groupName())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success('Reverted to inferred schema');
          this.editing.set(false);
          this.saving.set(false);
          this.schemaChanged.emit();
        },
        error: (error: Error) => {
          this.notification.error(error.message);
          this.saving.set(false);
        },
      });
  }

  addExtraPart(): void {
    const part = this.newExtraPart().trim().toLowerCase();
    if (!part) return;
    this.editExtraParts.update((parts) => {
      if (parts.includes(part)) return parts;
      return [...parts, part];
    });
    this.newExtraPart.set('');
  }

  removeExtraPart(index: number): void {
    this.editExtraParts.update((parts) => parts.filter((_, i) => i !== index));
  }
}
