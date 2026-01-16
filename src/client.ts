import { createHash } from 'crypto';
import type {
  MpakClientConfig,
  SkillReference,
  GithubSkillReference,
  UrlSkillReference,
  ResolvedSkill,
  SkillContentResult,
  GetSkillContentOptions,
  SkillSearchOptions,
  SkillSearchResponse,
} from './types.js';
import {
  MpakNotFoundError,
  MpakIntegrityError,
  MpakNetworkError,
} from './errors.js';

const DEFAULT_REGISTRY_URL = 'https://api.mpak.dev';
const DEFAULT_TIMEOUT = 30000;

/**
 * Client for interacting with the mpak registry
 *
 * Zero runtime dependencies - uses native fetch and crypto only.
 * Requires Node.js 18+ for native fetch support.
 */
export class MpakClient {
  private readonly registryUrl: string;
  private readonly timeout: number;

  constructor(config: MpakClientConfig = {}) {
    this.registryUrl = config.registryUrl ?? DEFAULT_REGISTRY_URL;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * Fetch skill content directly from mpak registry
   *
   * @throws {MpakNotFoundError} If skill not found
   * @throws {MpakIntegrityError} If integrity check fails (fail-closed)
   * @throws {MpakNetworkError} For network failures
   */
  async getSkillContent(options: GetSkillContentOptions): Promise<SkillContentResult> {
    const version = options.version ?? 'latest';
    const encodedName = encodeURIComponent(options.name);
    const url = `${this.registryUrl}/v1/skills/${encodedName}/versions/${version}/content`;

    const response = await this.fetchWithTimeout(url);

    if (response.status === 404) {
      throw new MpakNotFoundError(`${options.name}@${version}`);
    }

    if (!response.ok) {
      throw new MpakNetworkError(`Failed to fetch skill: HTTP ${response.status}`);
    }

    const content = await response.text();

    // Integrity verification (fail-closed)
    if (options.integrity) {
      const verified = this.verifyIntegrity(content, options.integrity);
      if (!verified) {
        const actualHash = this.computeSha256(content);
        const expectedHash = this.extractHash(options.integrity);
        throw new MpakIntegrityError(expectedHash, actualHash);
      }
      return { content, version, verified: true };
    }

    return { content, version, verified: false };
  }

  /**
   * Resolve a skill reference to actual content
   * Supports mpak, github, and url sources
   *
   * @throws {MpakNotFoundError} If skill not found
   * @throws {MpakIntegrityError} If integrity check fails (fail-closed)
   * @throws {MpakNetworkError} For network failures
   */
  async resolveSkillRef(ref: SkillReference): Promise<ResolvedSkill> {
    switch (ref.source) {
      case 'mpak': {
        const result = await this.getSkillContent({
          name: ref.name,
          version: ref.version,
          integrity: ref.integrity,
        });
        return { ...result, source: 'mpak' };
      }

      case 'github':
        return this.resolveGithubSkill(ref);

      case 'url':
        return this.resolveUrlSkill(ref);

      default: {
        // Exhaustiveness check - TypeScript will error if we miss a case
        const _exhaustive: never = ref;
        throw new Error(`Unknown skill source: ${(_exhaustive as SkillReference).source}`);
      }
    }
  }

  /**
   * Search for skills in the registry
   */
  async searchSkills(options: SkillSearchOptions = {}): Promise<SkillSearchResponse> {
    const params = new URLSearchParams();
    if (options.query) params.set('q', options.query);
    if (options.tags) params.set('tags', options.tags);
    if (options.surface) params.set('surface', options.surface);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));

    const queryString = params.toString();
    const url = `${this.registryUrl}/v1/skills${queryString ? `?${queryString}` : ''}`;

    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new MpakNetworkError(`Failed to search skills: HTTP ${response.status}`);
    }

    return response.json() as Promise<SkillSearchResponse>;
  }

  /**
   * Resolve a skill from GitHub releases
   */
  private async resolveGithubSkill(ref: GithubSkillReference): Promise<ResolvedSkill> {
    const url = `https://github.com/${ref.repo}/releases/download/${ref.version}/${ref.path}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new MpakNotFoundError(`github:${ref.repo}/${ref.path}@${ref.version}`);
    }

    const content = await response.text();

    if (ref.integrity) {
      const verified = this.verifyIntegrity(content, ref.integrity);
      if (!verified) {
        const actualHash = this.computeSha256(content);
        const expectedHash = this.extractHash(ref.integrity);
        throw new MpakIntegrityError(expectedHash, actualHash);
      }
      return { content, version: ref.version, source: 'github', verified: true };
    }

    return { content, version: ref.version, source: 'github', verified: false };
  }

  /**
   * Resolve a skill from a direct URL
   */
  private async resolveUrlSkill(ref: UrlSkillReference): Promise<ResolvedSkill> {
    const response = await this.fetchWithTimeout(ref.url);

    if (!response.ok) {
      throw new MpakNotFoundError(`url:${ref.url}`);
    }

    const content = await response.text();

    if (ref.integrity) {
      const verified = this.verifyIntegrity(content, ref.integrity);
      if (!verified) {
        const actualHash = this.computeSha256(content);
        const expectedHash = this.extractHash(ref.integrity);
        throw new MpakIntegrityError(expectedHash, actualHash);
      }
      return { content, version: ref.version, source: 'url', verified: true };
    }

    return { content, version: ref.version, source: 'url', verified: false };
  }

  /**
   * Compute SHA256 hash of content
   */
  private computeSha256(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Extract hash from integrity string (removes 'sha256:' prefix)
   */
  private extractHash(integrity: string): string {
    if (integrity.startsWith('sha256:')) {
      return integrity.slice(7);
    }
    if (integrity.startsWith('sha256-')) {
      return integrity.slice(7);
    }
    return integrity;
  }

  /**
   * Verify content against integrity hash
   */
  private verifyIntegrity(content: string, integrity: string): boolean {
    const expectedHash = this.extractHash(integrity);
    const actualHash = this.computeSha256(content);
    return actualHash === expectedHash;
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeout);

    try {
      return await fetch(url, { signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new MpakNetworkError(`Request timeout after ${this.timeout}ms`);
      }
      throw new MpakNetworkError(
        error instanceof Error ? error.message : 'Network error'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
