/**
 * Utility functions for enum validation in tests
 */

/**
 * Helper to validate enum exhaustiveness and log details
 * @param enumObj The enum object to validate
 * @param expectedValues Array of expected enum values
 * @param enumName Name of the enum for logging
 * @param verbose Whether to log detailed validation info
 * @returns Object with validation results for use with expect()
 */
export function validateEnumExhaustiveness<T extends Record<string, string>>(
  enumObj: T,
  expectedValues: string[],
  enumName: string,
  verbose = false,
): {
  generatedValues: string[];
  allValuesPresent: boolean;
  countMatches: boolean;
} {
  if (verbose) {
    console.log(`\n=== Exhaustive ${enumName} Validation ===`);
  }

  const generatedValues = Object.values(enumObj);

  if (verbose) {
    console.log(`Expected count: ${expectedValues.length}`);
    console.log(`Generated count: ${generatedValues.length}`);
    console.log(`All values: ${expectedValues.join(', ')}`);
  }

  const countMatches = generatedValues.length === expectedValues.length;
  const allValuesPresent = expectedValues.every((value) => generatedValues.includes(value));

  if (verbose) {
    if (countMatches && allValuesPresent) {
      console.log(`All ${expectedValues.length} expected values found in generated enum`);
    }
  }

  return {
    generatedValues,
    allValuesPresent,
    countMatches,
  };
}
