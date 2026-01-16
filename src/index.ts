/**
 * @nimblebrain/mpak-sdk
 *
 * TypeScript SDK for mpak registry - MCPB bundles and Agent Skills
 *
 * Zero runtime dependencies - uses native fetch and crypto only.
 * Requires Node.js 18+ for native fetch support.
 *
 * @example
 * ```typescript
 * import { MpakClient } from '@nimblebrain/mpak-sdk';
 *
 * const client = new MpakClient();
 *
 * // Search for bundles
 * const bundles = await client.searchBundles({ q: 'mcp' });
 *
 * // Get bundle details
 * const bundle = await client.getBundle('@nimbletools/echo');
 *
 * // Search for skills
 * const skills = await client.searchSkills({ q: 'crm' });
 *
 * // Get skill details and download
 * const skill = await client.getSkill('@nimbletools/folk-crm');
 * const download = await client.getSkillDownload('@nimbletools/folk-crm');
 * const { content, verified } = await client.downloadSkillContent(
 *   download.url,
 *   download.skill.sha256
 * );
 * ```
 */

export { MpakClient } from './client.js';

// Configuration
export type { MpakClientConfig } from './types.js';

// Bundle types
export type {
  BundleSearchResponse,
  BundleDetailResponse,
  BundleVersionsResponse,
  BundleVersionResponse,
  BundleDownloadResponse,
  BundleIndexResponse,
  BundleSearchParams,
  Bundle,
  BundleDetail,
  BundleVersion,
  BundleArtifact,
  BundleDownloadInfo,
} from './types.js';

// Skill types
export type {
  SkillSearchResponse,
  SkillDetailResponse,
  SkillDownloadResponse,
  SkillSearchParams,
  Skill,
  SkillDetail,
  SkillDownloadInfo,
  SkillVersion,
} from './types.js';

// Common types
export type {
  Platform,
  Pagination,
  Provenance,
  Author,
} from './types.js';

// Errors
export {
  MpakError,
  MpakNotFoundError,
  MpakIntegrityError,
  MpakNetworkError,
} from './errors.js';
