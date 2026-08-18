export type GuidanceProfileKind = 'prompt_contract' | 'usage_recipe';
export type GuidanceStatus = 'published' | 'legacy_label' | 'undocumented';

export interface GuidanceAudienceContent {
  overview: string;
  use_cases: string[];
  tips: string[];
  caveats: string[];
}

export interface RawPromptTemplate {
  template_id: string;
  name: string;
  syntax: string;
  syntax_name?: string | null;
  template: string;
  variables: { name: string; description: string; required: boolean }[];
}

export interface TextUsageProfile {
  profile_id: string;
  kind: GuidanceProfileKind;
  display_name: string;
  aliases: string[];
  summary: string;
  user: GuidanceAudienceContent;
  developer: GuidanceAudienceContent;
  examples: { title: string; description?: string | null; rendered_prompt?: string | null }[];
  recommended_settings: Record<string, unknown>;
  sources: { url: string; title?: string | null; note?: string | null }[];
  deprecated: boolean;
  interaction_modes?: string[];
  accepted_roles?: string[];
  role_markers?: Record<string, string>;
  stop_sequences?: string[];
  templates?: RawPromptTemplate[];
  capability?: string | null;
  scenario?: string | null;
}

export interface TextUsageProfileSummary {
  profile_id: string;
  kind: GuidanceProfileKind;
  display_name: string;
  summary: string;
  aliases: string[];
  deprecated: boolean;
  assigned_model_count: number;
}

export interface GuidanceCatalogMetadata {
  schema_version: number;
  revision: number;
  updated_at?: number | null;
}

export interface TextUsageProfilePage {
  items: TextUsageProfileSummary[];
  total: number;
  metadata: GuidanceCatalogMetadata;
}

export interface ResolvedTextGuidance {
  model_name: string;
  summary: {
    status: GuidanceStatus;
    primary_profile_id?: string | null;
    supplemental_profile_ids: string[];
  };
  primary_profile?: TextUsageProfile | null;
  supplemental_profiles: TextUsageProfile[];
  legacy_instruct_format?: string | null;
  catalog_metadata: GuidanceCatalogMetadata;
}

export interface TextGuidanceAssignment {
  model_name: string;
  primary_profile_id: string;
  supplemental_profile_ids: string[];
  metadata?: {
    revision: number;
    updated_at?: number | null;
    updated_by?: string | null;
  };
}

export interface TextGuidanceAssignmentPage {
  items: TextGuidanceAssignment[];
  total: number;
  metadata: GuidanceCatalogMetadata;
}

export interface TextGuidanceChangeSet {
  title: string;
  profile_changes: Record<string, unknown>[];
  assignment_changes: Record<string, unknown>[];
}

export interface GuidanceMigrationPreview {
  change_set: TextGuidanceChangeSet | null;
  source_model_count: number;
  format_count: number;
}
