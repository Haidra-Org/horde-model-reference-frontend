export type SizeUnit = 'B' | 'M';

export interface ParsedSize {
  value: number;
  unit: SizeUnit;
}

export function parseSizeLabel(sizeLabel: string): ParsedSize | null {
  const normalized = sizeLabel.trim().toUpperCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)(?:X(\d+(?:\.\d+)?))?\s*([BM])$/);
  if (!match) {
    return null;
  }

  const primary = Number(match[1]);
  const secondary = match[2] ? Number(match[2]) : 1;
  const value = primary * secondary;
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const unit = match[3] as SizeUnit;
  return { value, unit };
}

export interface SyncedParameters {
  value: number | null;
  unit: SizeUnit;
}

export function syncParametersFromSize(sizeLabel: string, linked: boolean): SyncedParameters {
  if (!linked) {
    return { value: null, unit: 'B' };
  }
  const parsed = parseSizeLabel(sizeLabel);
  if (!parsed) {
    return { value: null, unit: 'B' };
  }
  return { value: parsed.value, unit: parsed.unit };
}
