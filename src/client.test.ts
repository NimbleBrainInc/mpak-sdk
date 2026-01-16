import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { MpakClient } from './client.js';
import {
  MpakNotFoundError,
  MpakIntegrityError,
  MpakNetworkError,
} from './errors.js';

// Helper to compute SHA256 hash (same as client implementation)
function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

// Helper to create a mock Response
function mockResponse(
  body: string,
  init: { status?: number; ok?: boolean } = {}
): Response {
  return {
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
    status: init.status ?? 200,
    ok: init.ok ?? (init.status === undefined || init.status < 400),
  } as Response;
}

describe('MpakClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('uses default registry URL when not specified', async () => {
      const client = new MpakClient();
      fetchMock.mockResolvedValueOnce(mockResponse('content'));

      await client.getSkillContent({ name: 'test', version: '1.0.0' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('https://api.mpak.dev'),
        expect.any(Object)
      );
    });

    it('uses custom registry URL when specified', async () => {
      const client = new MpakClient({
        registryUrl: 'https://custom.registry.com',
      });
      fetchMock.mockResolvedValueOnce(mockResponse('content'));

      await client.getSkillContent({ name: 'test', version: '1.0.0' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('https://custom.registry.com'),
        expect.any(Object)
      );
    });
  });

  describe('getSkillContent', () => {
    it('fetches skill content from registry', async () => {
      const client = new MpakClient();
      const expectedContent = '# My Skill\n\nThis is a skill.';
      fetchMock.mockResolvedValueOnce(mockResponse(expectedContent));

      const result = await client.getSkillContent({
        name: '@nimbletools/folk-crm',
        version: '1.0.0',
      });

      expect(result.content).toBe(expectedContent);
      expect(result.version).toBe('1.0.0');
    });

    it('URL-encodes skill names with special characters', async () => {
      const client = new MpakClient();
      fetchMock.mockResolvedValueOnce(mockResponse('content'));

      await client.getSkillContent({
        name: '@nimbletools/folk-crm',
        version: '1.0.0',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('%40nimbletools%2Ffolk-crm'),
        expect.any(Object)
      );
    });

    it('defaults to "latest" version when not specified', async () => {
      const client = new MpakClient();
      fetchMock.mockResolvedValueOnce(mockResponse('content'));

      await client.getSkillContent({ name: 'test' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/versions/latest/content'),
        expect.any(Object)
      );
    });

    it('throws MpakNotFoundError on 404', async () => {
      const client = new MpakClient();
      fetchMock.mockResolvedValueOnce(mockResponse('', { status: 404 }));

      await expect(
        client.getSkillContent({ name: 'nonexistent', version: '1.0.0' })
      ).rejects.toThrow(MpakNotFoundError);
    });

    it('throws MpakNetworkError on server error', async () => {
      const client = new MpakClient();
      fetchMock.mockResolvedValueOnce(
        mockResponse('', { status: 500, ok: false })
      );

      await expect(
        client.getSkillContent({ name: 'test', version: '1.0.0' })
      ).rejects.toThrow(MpakNetworkError);
    });

    describe('integrity verification', () => {
      it('returns verified: false when no integrity hash provided', async () => {
        const client = new MpakClient();
        fetchMock.mockResolvedValueOnce(mockResponse('content'));

        const result = await client.getSkillContent({
          name: 'test',
          version: '1.0.0',
        });

        expect(result.verified).toBe(false);
      });

      it('returns verified: true when hash matches', async () => {
        const client = new MpakClient();
        const content = 'skill content';
        const hash = sha256(content);
        fetchMock.mockResolvedValueOnce(mockResponse(content));

        const result = await client.getSkillContent({
          name: 'test',
          version: '1.0.0',
          integrity: `sha256:${hash}`,
        });

        expect(result.verified).toBe(true);
        expect(result.content).toBe(content);
      });

      it('throws MpakIntegrityError when hash does not match (fail-closed)', async () => {
        const client = new MpakClient();
        const content = 'actual content';
        fetchMock.mockResolvedValueOnce(mockResponse(content));

        await expect(
          client.getSkillContent({
            name: 'test',
            version: '1.0.0',
            integrity: 'sha256:wrong_hash',
          })
        ).rejects.toThrow(MpakIntegrityError);
      });

      it('does not return content when integrity fails', async () => {
        const client = new MpakClient();
        const secretContent = 'sensitive skill content';
        fetchMock.mockResolvedValueOnce(mockResponse(secretContent));

        let leakedContent: string | undefined;
        try {
          const result = await client.getSkillContent({
            name: 'test',
            version: '1.0.0',
            integrity: 'sha256:wrong_hash',
          });
          leakedContent = result.content;
        } catch {
          // Expected
        }

        expect(leakedContent).toBeUndefined();
      });

      it('supports sha256- prefix (SRI format)', async () => {
        const client = new MpakClient();
        const content = 'skill content';
        const hash = sha256(content);
        fetchMock.mockResolvedValueOnce(mockResponse(content));

        const result = await client.getSkillContent({
          name: 'test',
          version: '1.0.0',
          integrity: `sha256-${hash}`,
        });

        expect(result.verified).toBe(true);
      });

      it('supports bare hash without prefix', async () => {
        const client = new MpakClient();
        const content = 'skill content';
        const hash = sha256(content);
        fetchMock.mockResolvedValueOnce(mockResponse(content));

        const result = await client.getSkillContent({
          name: 'test',
          version: '1.0.0',
          integrity: hash,
        });

        expect(result.verified).toBe(true);
      });
    });
  });

  describe('resolveSkillRef', () => {
    it('resolves mpak source through getSkillContent', async () => {
      const client = new MpakClient();
      const content = 'skill content';
      fetchMock.mockResolvedValueOnce(mockResponse(content));

      const result = await client.resolveSkillRef({
        source: 'mpak',
        name: '@nimbletools/folk-crm',
        version: '1.0.0',
      });

      expect(result.source).toBe('mpak');
      expect(result.content).toBe(content);
    });

    it('resolves github source from releases', async () => {
      const client = new MpakClient();
      const content = '# GitHub Skill';
      fetchMock.mockResolvedValueOnce(mockResponse(content));

      const result = await client.resolveSkillRef({
        source: 'github',
        name: 'folk-crm',
        version: 'v1.0.0',
        repo: 'folkcrm/folk-mcp',
        path: 'skills/folk-crm.skill',
      });

      expect(result.source).toBe('github');
      expect(result.content).toBe(content);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://github.com/folkcrm/folk-mcp/releases/download/v1.0.0/skills/folk-crm.skill',
        expect.any(Object)
      );
    });

    it('resolves url source directly', async () => {
      const client = new MpakClient();
      const content = '# Direct URL Skill';
      fetchMock.mockResolvedValueOnce(mockResponse(content));

      const result = await client.resolveSkillRef({
        source: 'url',
        name: 'custom-skill',
        version: '1.0.0',
        url: 'https://example.com/skills/custom.skill',
      });

      expect(result.source).toBe('url');
      expect(result.content).toBe(content);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/skills/custom.skill',
        expect.any(Object)
      );
    });

    it('verifies integrity for github source', async () => {
      const client = new MpakClient();
      const content = 'github skill';
      const hash = sha256(content);
      fetchMock.mockResolvedValueOnce(mockResponse(content));

      const result = await client.resolveSkillRef({
        source: 'github',
        name: 'test',
        version: 'v1.0.0',
        repo: 'owner/repo',
        path: 'skill.md',
        integrity: `sha256:${hash}`,
      });

      expect(result.verified).toBe(true);
    });

    it('throws MpakNotFoundError for github 404', async () => {
      const client = new MpakClient();
      fetchMock.mockResolvedValueOnce(
        mockResponse('', { status: 404, ok: false })
      );

      await expect(
        client.resolveSkillRef({
          source: 'github',
          name: 'test',
          version: 'v1.0.0',
          repo: 'owner/repo',
          path: 'skill.md',
        })
      ).rejects.toThrow(MpakNotFoundError);
    });
  });

  describe('searchSkills', () => {
    it('returns search results', async () => {
      const client = new MpakClient();
      const searchResponse = {
        skills: [
          { name: 'skill-1', description: 'First skill', version: '1.0.0' },
          { name: 'skill-2', description: 'Second skill', version: '2.0.0' },
        ],
        total: 2,
        offset: 0,
        limit: 20,
      };
      fetchMock.mockResolvedValueOnce(mockResponse(JSON.stringify(searchResponse)));

      const result = await client.searchSkills({ query: 'crm' });

      expect(result.skills).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('passes query parameters correctly', async () => {
      const client = new MpakClient();
      fetchMock.mockResolvedValueOnce(
        mockResponse(JSON.stringify({ skills: [], total: 0, offset: 0, limit: 10 }))
      );

      await client.searchSkills({
        query: 'crm',
        tags: 'sales,contacts',
        surface: 'claude-code',
        limit: 10,
        offset: 5,
      });

      const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain('q=crm');
      expect(calledUrl).toContain('tags=sales%2Ccontacts');
      expect(calledUrl).toContain('surface=claude-code');
      expect(calledUrl).toContain('limit=10');
      expect(calledUrl).toContain('offset=5');
    });

    it('handles empty search with no parameters', async () => {
      const client = new MpakClient();
      fetchMock.mockResolvedValueOnce(
        mockResponse(JSON.stringify({ skills: [], total: 0, offset: 0, limit: 20 }))
      );

      await client.searchSkills();

      const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(calledUrl).not.toContain('?');
    });
  });

  describe('timeout handling', () => {
    it('throws MpakNetworkError on timeout', async () => {
      const client = new MpakClient({ timeout: 100 });

      fetchMock.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              const error = new Error('AbortError');
              error.name = 'AbortError';
              reject(error);
            }, 50);
          })
      );

      await expect(
        client.getSkillContent({ name: 'test', version: '1.0.0' })
      ).rejects.toThrow(MpakNetworkError);
    });

    it('includes timeout duration in error message', async () => {
      const client = new MpakClient({ timeout: 5000 });

      fetchMock.mockImplementationOnce(() => {
        const error = new Error('AbortError');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(
        client.getSkillContent({ name: 'test', version: '1.0.0' })
      ).rejects.toThrow('5000ms');
    });

    it('wraps generic fetch errors as MpakNetworkError', async () => {
      const client = new MpakClient();
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        client.getSkillContent({ name: 'test', version: '1.0.0' })
      ).rejects.toThrow(MpakNetworkError);
    });
  });
});
