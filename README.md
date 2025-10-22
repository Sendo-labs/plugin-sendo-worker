# @standujar/plugin-sendo-worker

Sendo Worker plugin for ElizaOS - provides worker task management and execution capabilities.

## Description

This plugin integrates worker task management and execution functionality into ElizaOS agents.

## Installation

```bash
npm install @standujar/plugin-sendo-worker
```

or

```bash
bun add @standujar/plugin-sendo-worker
```

## Usage

Import and register the plugin in your ElizaOS agent:

```typescript
import { sendoWorkerPlugin } from '@standujar/plugin-sendo-worker';

const agent = {
  plugins: [sendoWorkerPlugin],
  // ... other configuration
};
```

## Development

### Build

```bash
npm run build
```

### Watch mode

```bash
npm run dev
```

### Clean

```bash
npm run clean
```

### Lint and format

```bash
npm run lint
npm run format
```

## Structure

```
plugin-sendo-worker/
├── src/
│   ├── actions/       # Agent actions
│   ├── config/        # Configuration files
│   ├── services/      # Core services
│   ├── templates/     # Prompt templates
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions
│   └── index.ts       # Main plugin export
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## License

MIT
