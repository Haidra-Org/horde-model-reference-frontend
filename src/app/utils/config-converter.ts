/**
 * Utilities for converting between simplified download config (v2-style)
 * and legacy config format (with files and download arrays).
 *
 * This allows users to edit legacy models using a simplified interface
 * while maintaining full legacy format compatibility in JSON view and API.
 */

import { LegacyConfig, LegacyConfigDownload } from '../models/api.models';
import { DownloadRecord } from '../api-client';

/**
 * Simplified download configuration for editing
 * (matches v2 GenericModelRecordConfig structure)
 */
export interface SimplifiedDownloadConfig {
  download: DownloadRecord[];
}

/**
 * Convert legacy config format to simplified download records for editing
 *
 * @param legacyConfig Legacy config with files and download arrays
 * @returns Simplified config with only download records
 */
export function legacyConfigToSimplified(
  legacyConfig: LegacyConfig | null | undefined,
): SimplifiedDownloadConfig {
  if (!legacyConfig || !legacyConfig.download) {
    return { download: [] };
  }

  // Build a lookup map of sha256sum from files array by path/filename
  // This handles the older legacy format where sha256sum was in a separate files array
  const sha256sumLookup = new Map<string, string>();
  if (legacyConfig.files) {
    for (const fileEntry of legacyConfig.files) {
      const path = fileEntry.path;
      const sha256 = fileEntry['sha256sum'];
      if (path && sha256 && typeof sha256 === 'string') {
        sha256sumLookup.set(path, sha256);
      }
    }
  }

  const download: DownloadRecord[] = legacyConfig.download.map((legacyDownload) => {
    const record: DownloadRecord = {
      file_name: legacyDownload.file_name || '',
      file_url: legacyDownload.file_url || '',
    };

    // Extract sha256sum from two possible sources:
    // 1. Directly in the download entry (modern/clean format)
    // 2. From files array matched by file_name (older legacy format)
    // Priority: download entry takes precedence over files array
    const directSha256sum = legacyDownload['sha256sum'];
    const filesSha256sum = legacyDownload.file_name ? sha256sumLookup.get(legacyDownload.file_name) : undefined;

    const sha256sum = directSha256sum || filesSha256sum;
    if (sha256sum && typeof sha256sum === 'string') {
      record.sha256sum = sha256sum;
    }

    return record;
  });

  return { download };
}

/**
 * Convert simplified download records back to legacy config format
 *
 * @param simplified Simplified config with download records
 * @param preserveFiles Optional existing files array to preserve (typically empty in new format)
 * @returns Legacy config with files and download arrays
 */
export function simplifiedToLegacyConfig(
  simplified: SimplifiedDownloadConfig | null | undefined,
  preserveFiles: LegacyConfig['files'] = [],
): LegacyConfig {
  if (!simplified || !simplified.download || simplified.download.length === 0) {
    return {
      files: preserveFiles || [],
      download: [],
    };
  }

  const download: LegacyConfigDownload[] = simplified.download.map((simpleDownload) => {
    const legacyDownload: any = {
      file_name: simpleDownload.file_name || null,
      file_path: '', // Always empty string as per legacy format validation
      file_url: simpleDownload.file_url || null,
    };

    // Preserve sha256sum in the legacy download entry
    // In legacy format, sha256sum is stored as an additional property in download entries
    if (simpleDownload.sha256sum) {
      legacyDownload.sha256sum = simpleDownload.sha256sum;
    }

    return legacyDownload;
  });

  return {
    files: preserveFiles || [],
    download,
  };
}

/**
 * Validate that a simplified download record has required fields
 *
 * @param record Download record to validate
 * @returns True if valid, false otherwise
 */
export function isValidDownloadRecord(record: DownloadRecord): boolean {
  return !!(record.file_name && record.file_name.trim() && record.file_url && record.file_url.trim());
}

/**
 * Create an empty download record for adding new entries
 *
 * @returns Empty download record
 */
export function createEmptyDownloadRecord(): DownloadRecord {
  return {
    file_name: '',
    file_url: '',
  };
}
