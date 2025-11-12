export type ThemeMode = 'light' | 'dark';

export interface ThemeCategory {
  id: string;
  name: string;
  description: string;
}

export type ThemeCategoryId = ThemeCategory['id'];

/**
 * Metadata describing a theme option available to the user. All visual
 * implementation lives in CSS so that style concerns stay out of the
 * application logic.
 */
export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  family: ThemeCategoryId;
  colorMode: ThemeMode;
}

export type ThemeId = ThemeDefinition['id'];
