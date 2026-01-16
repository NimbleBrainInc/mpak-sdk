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
 * // Fetch skill content
 * const skill = await client.getSkillContent({
 *   name: '@nimbletools/folk-crm',
 *   version: '1.0.0',
 * });
 *
 * // Resolve skill reference (from mcp-registry metadata)
 * const resolved = await client.resolveSkillRef({
 *   source: 'mpak',
 *   name: '@nimbletools/folk-crm',
 *   version: '1.0.0',
 *   integrity: 'sha256:abc123...',
 * });
 * ```
 */

export { MpakClient } from './client.js';

export type {
  MpakClientConfig,
  SkillReference,
  MpakSkillReference,
  GithubSkillReference,
  UrlSkillReference,
  ResolvedSkill,
  SkillContentResult,
  GetSkillContentOptions,
  SkillSearchOptions,
  SkillSearchResult,
  SkillSearchResponse,
} from './types.js';

export {
  MpakError,
  MpakNotFoundError,
  MpakIntegrityError,
  MpakNetworkError,
} from './errors.js';
