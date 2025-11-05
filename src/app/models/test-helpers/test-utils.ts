/**
 * Shared test utilities for Angular component testing
 */

/**
 * Helper to query elements with type safety
 */
export function queryElement<T extends HTMLElement = HTMLElement>(
  fixture: { nativeElement: HTMLElement },
  selector: string,
): T | null {
  return fixture.nativeElement.querySelector<T>(selector);
}

/**
 * Helper to query all elements with type safety
 */
export function queryElements<T extends HTMLElement = HTMLElement>(
  fixture: { nativeElement: HTMLElement },
  selector: string,
): T[] {
  return Array.from(fixture.nativeElement.querySelectorAll<T>(selector));
}

/**
 * Helper to get text content from an element
 */
export function getTextContent(
  fixture: { nativeElement: HTMLElement },
  selector: string,
): string | null {
  const element = queryElement(fixture, selector);
  return element?.textContent?.trim() ?? null;
}

/**
 * Helper to check if an element exists
 */
export function elementExists(fixture: { nativeElement: HTMLElement }, selector: string): boolean {
  return queryElement(fixture, selector) !== null;
}

/**
 * Helper to trigger a click event
 */
export function clickElement(fixture: { nativeElement: HTMLElement }, selector: string): void {
  const element = queryElement(fixture, selector);
  if (element) {
    element.click();
  } else {
    throw new Error(`Element not found: ${selector}`);
  }
}

/**
 * Helper to set input value and dispatch input event
 */
export function setInputValue(
  fixture: { nativeElement: HTMLElement },
  selector: string,
  value: string,
): void {
  const input = queryElement<HTMLInputElement>(fixture, selector);
  if (input) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  } else {
    throw new Error(`Input element not found: ${selector}`);
  }
}

/**
 * Helper to get button by text content
 */
export function getButtonByText(
  fixture: { nativeElement: HTMLElement },
  text: string,
): HTMLButtonElement | null {
  const buttons = queryElements<HTMLButtonElement>(fixture, 'button');
  return buttons.find((btn) => btn.textContent?.trim() === text) ?? null;
}
