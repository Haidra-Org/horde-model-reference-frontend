import {
  LegacyRecordUnion,
  LegacyStableDiffusionRecord,
  isLegacyStableDiffusionRecord,
} from '../../models';

export function getDownloadCount(model: LegacyRecordUnion): number {
  return model.config?.download?.length ?? 0;
}

export function getObjectKeysLength(obj: Record<string, unknown> | null | undefined): number {
  return obj ? Object.keys(obj).length : 0;
}

export function formatSizeInGB(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(2);
}

export function formatParametersInBillions(params: number): string {
  return params >= 1_000_000_000
    ? `${(params / 1_000_000_000).toFixed(0)}B`
    : `${(params / 1_000_000).toFixed(0)}M`;
}

export function formatRequirements(requirements: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(requirements)) {
    if (Array.isArray(value)) {
      lines.push(`  ${key}: ${value.join(', ')}`);
    } else {
      lines.push(`  ${key}: ${value}`);
    }
  }
  return lines.join('\n');
}

export function hasShowcases(model: LegacyRecordUnion): boolean {
  return (
    isLegacyStableDiffusionRecord(model) && !!model.showcases && model.showcases.length > 0
  );
}

export function hasRequirements(model: LegacyRecordUnion): boolean {
  return (
    isLegacyStableDiffusionRecord(model) &&
    !!model.requirements &&
    Object.keys(model.requirements).length > 0
  );
}

export function onImageError(event: Event): void {
  const img = event.target as HTMLImageElement;
  img.src =
    'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23999%27 stroke-width=%272%27%3E%3Crect x=%273%27 y=%273%27 width=%2718%27 height=%2718%27 rx=%272%27/%3E%3Ccircle cx=%278.5%27 cy=%278.5%27 r=%271.5%27/%3E%3Cpath d=%27M21 15l-5-5L5 21%27/%3E%3C/svg%3E';
}
