/**
 * Type-level assertion utilities for compile-time type checking
 */

/**
 * Helper for compile-time type assertions
 * @returns Object indicating bidirectional type compatibility
 */
export function assertBidirectionalTypeCompatibility<T1, T2>(): {
  forward: T1 extends T2 ? true : false;
  backward: T2 extends T1 ? true : false;
} {
  // Using type assertions instead of `any` for compile-time checks
  return {
    forward: true as T1 extends T2 ? true : false,
    backward: true as T2 extends T1 ? true : false,
  };
}

/**
 * Type guard to check if verbose testing is enabled
 */
function isVerboseTestingEnabled(): boolean {
  return Boolean((globalThis as { VERBOSE_TESTS?: boolean }).VERBOSE_TESTS);
}

/**
 * Test logger utility to reduce console noise
 */
export const testLogger = {
  logCompileTimeCheck: (testName: string, willFailIf: string[]) => {
    if (isVerboseTestingEnabled()) {
      console.log(`\n=== ${testName} ===`);
      console.log('WILL FAIL AT COMPILE TIME IF:');
      willFailIf.forEach((condition) => console.log(`  - ${condition}`));
    }
  },
  logSuccess: (message: string) => {
    if (isVerboseTestingEnabled()) {
      console.log(message);
    }
  },
};
