import {
  LegacyConfigFile,
  LegacyConfigDownload,
  LegacyConfig,
  LegacyRecordUnion,
  LegacyStableDiffusionRecord,
  LegacyTextGenerationRecord,
} from './api.models';
import { isLegacyStableDiffusionRecord, isLegacyTextGenerationRecord } from './legacy-type-guards';

export interface ValidationIssue {
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

const ALLOWED_CONFIG_FILENAMES = new Set(['v2-inference-v.yaml', 'v1-inference.yaml']);

export function validateConfigFile(file: LegacyConfigFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!file.path) {
    issues.push({
      field: 'config.files[].path',
      message: 'Config file has no path',
      severity: 'error',
    });
    return issues;
  }

  if (file.path.includes('.yaml') || file.path.includes('.json')) {
    const filename = file.path.split('/').pop() || '';
    if (file.path.includes('.yaml') && !ALLOWED_CONFIG_FILENAMES.has(filename)) {
      issues.push({
        field: 'config.files[].path',
        message: 'Non-standard config file',
        severity: 'warning',
      });
    }
    return issues;
  }

  if (
    !file.path.endsWith('.ckpt') &&
    !file.path.endsWith('.safetensors') &&
    !file.path.endsWith('.pt')
  ) {
    issues.push({
      field: 'config.files[].path',
      message: 'Config file might have an invalid path',
      severity: 'warning',
    });
  }

  if (!file.sha256sum) {
    issues.push({
      field: 'config.files[].sha256sum',
      message: 'Config file missing sha256sum',
      severity: 'error',
    });
  } else if (file.sha256sum.length !== 64) {
    issues.push({
      field: 'config.files[].sha256sum',
      message: 'Invalid sha256sum (must be 64 characters)',
      severity: 'error',
    });
  }

  return issues;
}

export function validateConfigDownload(download: LegacyConfigDownload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!download.file_name) {
    issues.push({
      field: 'config.download[].file_name',
      message: 'Download has no file_name',
      severity: 'error',
    });
  }

  if (!download.file_url) {
    issues.push({
      field: 'config.download[].file_url',
      message: 'Download has no file_url',
      severity: 'warning',
    });
  } else {
    try {
      new URL(download.file_url);
    } catch {
      issues.push({
        field: 'config.download[].file_url',
        message: 'Invalid file_url',
        severity: 'error',
      });
    }
  }

  if (download.file_path && download.file_path !== '') {
    issues.push({
      field: 'config.download[].file_path',
      message: 'file_path should be empty',
      severity: 'warning',
    });
  }

  return issues;
}

export function validateConfig(config: LegacyConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (config.files) {
    config.files.forEach((file) => {
      issues.push(...validateConfigFile(file));
    });
  }

  if (config.download) {
    config.download.forEach((download) => {
      issues.push(...validateConfigDownload(download));
    });
  }

  const hasFiles = config.files && config.files.length > 0;
  const hasDownloads = config.download && config.download.length > 0;

  if (!hasFiles && !hasDownloads) {
    issues.push({
      field: 'config',
      message: 'Config has no files or downloads',
      severity: 'warning',
    });
  }

  return issues;
}

export function validateLegacyRecord(record: LegacyRecordUnion): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!record.name) {
    issues.push({
      field: 'name',
      message: 'Name is required',
      severity: 'error',
    });
  }

  if (!record.description) {
    issues.push({
      field: 'description',
      message: 'Description is missing',
      severity: 'warning',
    });
  }

  if (record.style === '') {
    issues.push({
      field: 'style',
      message: 'Style is empty',
      severity: 'warning',
    });
  }

  if (record.available) {
    issues.push({
      field: 'available',
      message: "Should not be flagged 'available'",
      severity: 'warning',
    });
  }

  if (record.config) {
    issues.push(...validateConfig(record.config));
  }

  if (isLegacyStableDiffusionRecord(record)) {
    issues.push(...validateStableDiffusionRecord(record));
  } else if (isLegacyTextGenerationRecord(record)) {
    issues.push(...validateTextGenerationRecord(record));
  }

  return issues;
}

function validateStableDiffusionRecord(record: LegacyStableDiffusionRecord): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (record.type !== 'ckpt') {
    issues.push({
      field: 'type',
      message: 'Type should be "ckpt"',
      severity: 'warning',
    });
  }

  if (!record.baseline) {
    issues.push({
      field: 'baseline',
      message: 'Baseline is required',
      severity: 'error',
    });
  }

  if (record.showcases && record.showcases.some((showcase) => showcase.includes('huggingface'))) {
    issues.push({
      field: 'showcases',
      message: 'Should not include huggingface showcases',
      severity: 'warning',
    });
  }

  return issues;
}

function validateTextGenerationRecord(record: LegacyTextGenerationRecord): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (record.parameters === null || record.parameters === undefined) {
    issues.push({
      field: 'parameters',
      message: 'Parameters count is required',
      severity: 'error',
    });
  }

  return issues;
}

export function hasErrorIssues(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

export function groupIssuesBySeverity(issues: ValidationIssue[]): {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
} {
  return {
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
  };
}
