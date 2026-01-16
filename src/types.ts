/**
 * Configuration options for MpakClient
 */
export interface MpakClientConfig {
  /**
   * Base URL for the mpak registry API
   * @default 'https://api.mpak.dev'
   */
  registryUrl?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
}

/**
 * Base fields shared by all skill reference types
 */
interface SkillReferenceBase {
  /** Skill artifact identifier (e.g., '@nimbletools/folk-crm') */
  name: string;

  /** Semver version (e.g., '1.0.0') or 'latest' */
  version: string;

  /** SHA256 integrity hash (format: 'sha256-hexdigest') */
  integrity?: string;
}

/**
 * Skill reference from mpak registry
 */
export interface MpakSkillReference extends SkillReferenceBase {
  source: 'mpak';
}

/**
 * Skill reference from GitHub repository
 */
export interface GithubSkillReference extends SkillReferenceBase {
  source: 'github';
  /** GitHub repository (owner/repo) */
  repo: string;
  /** Path to skill file in repo */
  path: string;
}

/**
 * Skill reference from direct URL
 */
export interface UrlSkillReference extends SkillReferenceBase {
  source: 'url';
  /** Direct download URL */
  url: string;
}

/**
 * Discriminated union of skill reference types
 * This is what gets stored in mcp-registry server metadata
 */
export type SkillReference = MpakSkillReference | GithubSkillReference | UrlSkillReference;

/**
 * Result of resolving a skill reference to actual content
 */
export interface ResolvedSkill {
  /** The markdown content of the skill */
  content: string;

  /** Version that was resolved */
  version: string;

  /** Source the skill was fetched from */
  source: 'mpak' | 'github' | 'url';

  /** Whether integrity was verified (true if hash matched, false if no hash provided) */
  verified: boolean;
}

/**
 * Result of fetching skill content directly
 */
export interface SkillContentResult {
  /** The markdown content of the skill */
  content: string;

  /** Version that was fetched */
  version: string;

  /** Whether integrity was verified */
  verified: boolean;
}

/**
 * Options for getSkillContent method
 */
export interface GetSkillContentOptions {
  /** Skill name (e.g., '@nimbletools/folk-crm') */
  name: string;

  /** Version to fetch (defaults to 'latest') */
  version?: string;

  /** Expected integrity hash (fails closed if provided and mismatches) */
  integrity?: string;
}

/**
 * Options for searching skills
 */
export interface SkillSearchOptions {
  /** Search query string */
  query?: string;

  /** Filter by tags (comma-separated) */
  tags?: string;

  /** Filter by surface (e.g., 'claude-code', 'nira') */
  surface?: string;

  /** Maximum results to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * A skill in search results
 */
export interface SkillSearchResult {
  name: string;
  description: string;
  version: string;
  tags?: string[];
  author?: string;
}

/**
 * Response from skill search
 */
export interface SkillSearchResponse {
  skills: SkillSearchResult[];
  total: number;
  offset: number;
  limit: number;
}
