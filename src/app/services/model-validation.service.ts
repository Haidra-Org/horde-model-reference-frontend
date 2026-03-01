import { Injectable, signal } from '@angular/core';
import type { HTTPValidationError, ValidationError } from '../api-client/model/models';
import type { LegacyRecordUnion } from '../models/api.models';
import {
  type ValidationIssue,
  validateLegacyRecord,
  validateV2Record,
  hasErrorIssues,
  groupIssuesBySeverity,
} from '../models/legacy-validators';

/**
 * Represents a field-level error mapped from server validation response
 */
export interface ServerFieldError {
  /** The field path (e.g., "baseline", "config.download[0].file_url") */
  path: string;
  /** The last segment of the path for display purposes */
  field: string;
  /** The error message from the server */
  message: string;
  /** The error type from FastAPI */
  type: string;
}

/**
 * Result of analyzing validation issues
 */
export interface ValidationAnalysis {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  hasErrors: boolean;
}

/**
 * Service for validating model records and handling server validation errors.
 *
 * This service wraps the pure validation functions from legacy-validators.ts
 * and provides additional functionality for mapping server-side validation
 * errors (from 422 responses) to form fields.
 */
@Injectable({
  providedIn: 'root',
})
export class ModelValidationService {
  /**
   * Signal containing field-level errors from the last server validation failure.
   * Components can subscribe to this to display field-specific error messages.
   */
  readonly serverErrors = signal<ServerFieldError[]>([]);

  /**
   * Validates a model record using format-appropriate rules.
   *
   * @param record The model record to validate
   * @param canonicalFormat The active backend format ('legacy' or 'v2')
   * @returns Array of validation issues (errors and warnings)
   */
  validateRecord(record: LegacyRecordUnion, canonicalFormat?: string): ValidationIssue[] {
    const issues = validateLegacyRecord(record);
    if (canonicalFormat === 'v2') {
      issues.push(...validateV2Record(record));
    }
    return issues;
  }

  /**
   * Analyzes validation issues and groups them by severity.
   *
   * @param issues Array of validation issues to analyze
   * @returns Object containing errors, warnings, and hasErrors flag
   */
  analyzeIssues(issues: ValidationIssue[]): ValidationAnalysis {
    const grouped = groupIssuesBySeverity(issues);
    return {
      ...grouped,
      hasErrors: hasErrorIssues(issues),
    };
  }

  /**
   * Maps server validation errors from a 422 response to field-level errors.
   * Also updates the serverErrors signal with the mapped errors.
   *
   * @param httpError The HTTPValidationError from the server response
   * @returns Array of ServerFieldError objects
   */
  mapServerErrors(httpError: HTTPValidationError): ServerFieldError[] {
    const errors = (httpError.detail ?? []).map((err) => this.mapSingleError(err));
    this.serverErrors.set(errors);
    return errors;
  }

  /**
   * Formats server validation errors into a human-readable string for display
   * in toast notifications.
   *
   * @param httpError The HTTPValidationError from the server response
   * @returns A formatted string describing all validation errors
   */
  formatServerErrors(httpError: HTTPValidationError): string {
    const errors = httpError.detail ?? [];
    if (errors.length === 0) {
      return 'Validation failed';
    }

    if (errors.length === 1) {
      const err = errors[0];
      const path = this.formatFieldPath(err.loc);
      return `${path}: ${err.msg}`;
    }

    // Multiple errors - show count and first few
    const formattedErrors = errors.slice(0, 3).map((err) => {
      const path = this.formatFieldPath(err.loc);
      return `${path}: ${err.msg}`;
    });

    const remaining = errors.length - 3;
    if (remaining > 0) {
      return `${formattedErrors.join('; ')} (+${remaining} more)`;
    }

    return formattedErrors.join('; ');
  }

  /**
   * Clears any stored server errors.
   * Call this when starting a new form submission or when errors are resolved.
   */
  clearServerErrors(): void {
    this.serverErrors.set([]);
  }

  /**
   * Checks if a specific field has a server error.
   *
   * @param fieldPath The field path to check (e.g., "baseline", "config.files[0].path")
   * @returns true if the field has an error
   */
  hasFieldError(fieldPath: string): boolean {
    return this.serverErrors().some((err) => err.path === fieldPath || err.field === fieldPath);
  }

  /**
   * Gets the error message for a specific field.
   *
   * @param fieldPath The field path to get the error for
   * @returns The error message, or undefined if no error
   */
  getFieldError(fieldPath: string): string | undefined {
    const error = this.serverErrors().find(
      (err) => err.path === fieldPath || err.field === fieldPath,
    );
    return error?.message;
  }

  /**
   * Maps a single ValidationError to a ServerFieldError.
   */
  private mapSingleError(error: ValidationError): ServerFieldError {
    const path = this.formatFieldPath(error.loc);
    const field = this.extractFieldName(error.loc);

    return {
      path,
      field,
      message: error.msg,
      type: error.type,
    };
  }

  /**
   * Formats the loc array from a ValidationError into a dotted field path.
   * Skips the "body" prefix that FastAPI includes.
   *
   * @example ["body", "baseline"] => "baseline"
   * @example ["body", "config", "download", 0, "file_url"] => "config.download[0].file_url"
   */
  private formatFieldPath(loc: unknown[]): string {
    // Skip "body" prefix if present
    const parts = loc[0] === 'body' ? loc.slice(1) : loc;

    // Also skip model type discriminators like "ImageGenerationModelRecord"
    const filteredParts = parts.filter((part) => {
      if (typeof part === 'string') {
        // Skip parts that look like model type names
        return !part.includes('ModelRecord') && !part.includes('function-after');
      }
      return true;
    });

    if (filteredParts.length === 0) {
      return 'unknown';
    }

    return filteredParts
      .map((part, index) => {
        if (typeof part === 'number') {
          return `[${part}]`;
        }
        return index > 0 ? `.${String(part)}` : String(part);
      })
      .join('');
  }

  /**
   * Extracts the last meaningful field name from the loc array.
   */
  private extractFieldName(loc: unknown[]): string {
    // Work backwards to find the last string that isn't a model type
    for (let i = loc.length - 1; i >= 0; i--) {
      const part = loc[i];
      if (typeof part === 'string' && !part.includes('ModelRecord') && part !== 'body') {
        return part;
      }
    }
    return 'unknown';
  }
}
