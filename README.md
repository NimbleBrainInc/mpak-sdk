# @nimblebrain/mpak-sdk

TypeScript SDK for mpak registry - MCPB bundles and Agent Skills.

## Features

- Zero runtime dependencies (native `fetch` and `crypto` only)
- Requires Node.js 18+
- Type-safe API with full TypeScript support
- Fail-closed integrity verification
- Supports multiple skill sources: mpak, GitHub, URL

## Installation

```bash
npm install @nimblebrain/mpak-sdk
```

## Usage

### Basic Usage

```typescript
import { MpakClient } from '@nimblebrain/mpak-sdk';

const client = new MpakClient();

// Fetch skill content
const skill = await client.getSkillContent({
  name: '@nimbletools/folk-crm',
  version: '1.0.0',
});

console.log(skill.content); // Markdown content
console.log(skill.verified); // false (no integrity check)
```

### With Integrity Verification

```typescript
const skill = await client.getSkillContent({
  name: '@nimbletools/folk-crm',
  version: '1.0.0',
  integrity: 'sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
});

// Throws MpakIntegrityError if hash doesn't match (fail-closed)
console.log(skill.verified); // true
```

### Resolve Skill Reference

Used when fetching skills from mcp-registry metadata:

```typescript
import { MpakClient, type SkillReference } from '@nimblebrain/mpak-sdk';

const client = new MpakClient();

// From mcp-registry server metadata
const skillRef: SkillReference = {
  source: 'mpak',
  name: '@nimbletools/folk-crm',
  version: '1.0.0',
  integrity: 'sha256:...',
};

const resolved = await client.resolveSkillRef(skillRef);
console.log(resolved.content);
console.log(resolved.source); // 'mpak'
console.log(resolved.verified); // true
```

### GitHub Source

```typescript
const skillRef: SkillReference = {
  source: 'github',
  name: 'folk-crm',
  version: 'v1.0.0',
  repo: 'folkcrm/folk-mcp',
  path: 'skills/folk-crm.skill',
};

const resolved = await client.resolveSkillRef(skillRef);
```

### Search Skills

```typescript
const results = await client.searchSkills({
  query: 'crm',
  tags: 'sales,contacts',
  limit: 20,
});

for (const skill of results.skills) {
  console.log(`${skill.name}: ${skill.description}`);
}
```

## Error Handling

```typescript
import {
  MpakClient,
  MpakNotFoundError,
  MpakIntegrityError,
  MpakNetworkError,
} from '@nimblebrain/mpak-sdk';

const client = new MpakClient();

try {
  const skill = await client.getSkillContent({
    name: '@nimbletools/nonexistent',
    version: '1.0.0',
    integrity: 'sha256:expected-hash',
  });
} catch (error) {
  if (error instanceof MpakNotFoundError) {
    console.error('Skill not found:', error.message);
  } else if (error instanceof MpakIntegrityError) {
    // CRITICAL: Content was NOT returned (fail-closed)
    console.error('Integrity mismatch!');
    console.error('Expected:', error.expected);
    console.error('Actual:', error.actual);
  } else if (error instanceof MpakNetworkError) {
    console.error('Network error:', error.message);
  }
}
```

## Configuration

```typescript
const client = new MpakClient({
  registryUrl: 'https://api.mpak.dev', // Custom registry URL
  timeout: 30000, // Request timeout in ms
});
```

## API Reference

### MpakClient

#### `getSkillContent(options)`

Fetch skill content directly from mpak registry.

- `options.name` - Skill name (e.g., '@nimbletools/folk-crm')
- `options.version` - Version (default: 'latest')
- `options.integrity` - Expected SHA256 hash (optional, fails closed on mismatch)

#### `resolveSkillRef(ref)`

Resolve a skill reference to actual content. Supports mpak, github, and url sources.

#### `searchSkills(options)`

Search for skills in the registry.

### Error Types

- `MpakError` - Base error class
- `MpakNotFoundError` - Resource not found (404)
- `MpakIntegrityError` - Hash mismatch (content NOT returned)
- `MpakNetworkError` - Network failures, timeouts

## License

Apache-2.0
