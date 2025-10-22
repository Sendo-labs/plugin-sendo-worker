# @sendo-labs/plugin-sendo-worker

**Sendo Worker Plugin** - An intelligent orchestrator that dynamically analyzes agent capabilities, executes data collection actions, and generates LLM-powered recommendations.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Overview

The Sendo Worker plugin transforms ElizaOS agents into intelligent analysts by:
- **Discovering** available actions and providers dynamically
- **Categorizing** actions via LLM (DATA vs ACTION)
- **Executing** analysis actions in parallel
- **Generating** comprehensive 4-section analyses via LLM
- **Recommending** contextual actions with execution triggers
- **Tracking** action execution with async status updates

**Key principle**: 100% dynamic - zero hardcoded logic. The plugin adapts automatically to any installed plugins.

---

## ✨ Features

### 🔍 Dynamic Discovery
- Automatically discovers all available actions and providers
- LLM-based categorization (DATA vs ACTION)
- Adapts to new plugins without code changes

### ⚡ Intelligent Execution
- Parallel action execution for performance
- Smart filtering of relevant actions
- Dynamic trigger message generation via LLM
- Real runtime integration (no mocks)

### 📊 LLM-Powered Analysis
Four comprehensive sections:
- **Wallet Overview**: Holdings, balances, recent activity
- **Market Conditions**: Trends, sentiment, opportunities
- **Risk Assessment**: Exposure, volatility, warnings
- **Opportunities**: Actionable insights with data attribution

### 🎯 Smart Recommendations
- Context-aware action suggestions
- Confidence scoring and priority ranking
- Ready-to-execute trigger messages
- Estimated impact and gas costs

### 🔄 Async Execution
- Non-blocking action execution
- Real-time status tracking (pending → executing → completed/failed)
- Result storage with error handling
- Database persistence

---

## 📦 Installation

```bash
npm install @sendo-labs/plugin-sendo-worker
```

or with Bun:

```bash
bun add @sendo-labs/plugin-sendo-worker
```

---

## 🚀 Usage

### Basic Setup

```typescript
import { sendoWorkerPlugin } from '@sendo-labs/plugin-sendo-worker';

const agent = {
  plugins: [
    sendoWorkerPlugin,
    // ... your other plugins
  ],
};
```

### Running Analysis

The plugin exposes REST endpoints for analysis management:

#### Run Analysis
```bash
POST /analysis
```

Returns a complete analysis with recommendations based on all available plugins.

#### Get Analyses
```bash
GET /analysis
```

Returns list of recent analyses for the agent.

#### Get Recommendations
```bash
GET /analysis/:analysisId/actions
```

Returns recommended actions for a specific analysis.

#### Execute Actions
```bash
POST /actions/execute
Body: { actionIds: ["rec-123", "rec-456"] }
```

Executes recommended actions asynchronously.

#### Check Action Status
```bash
GET /action/:actionId
```

Returns current status and result of an action.

---

## 🏗️ Architecture

### Service Layer

**SendoWorkerService** (`src/services/sendoWorkerService.ts`)

Main orchestrator with these key methods:

- `runAnalysis()` - Complete workflow orchestrator
- `categorizeActions()` - LLM-based action classification
- `collectProviderData()` - Provider data collection
- `selectRelevantDataActions()` - Smart action filtering
- `executeAnalysisActions()` - Parallel action execution
- `generateAnalysis()` - LLM-powered 4-section analysis
- `generateRecommendations()` - Context-aware suggestions
- `executeActions()` - Async action execution

### Database Schema

**analysis_results**
- Stores complete analyses with LLM-generated insights
- Links to plugin attribution

**recommended_actions**
- Stores action recommendations
- Tracks execution status (pending/executing/completed/failed)
- Stores results and errors

### Helpers

**actionResult utilities** (`src/utils/actionResult.ts`)
- `getActionResultFromCache()` - Retrieve ActionResult from runtime stateCache
- `extractErrorMessage()` - Clean error message extraction

---

## 🛠️ Development

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database (for persistence)

### Build

```bash
bun run build
```

### Watch Mode

```bash
bun run dev
```

### Type Checking

```bash
bun run typecheck
```

---

## 📁 Project Structure

```
plugin-sendo-worker/
├── src/
│   ├── services/          # SendoWorkerService (main orchestrator)
│   ├── routes/            # REST API endpoints
│   ├── schemas/           # Drizzle ORM database schemas
│   ├── templates/         # LLM prompt templates
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Helper functions
│   └── index.ts           # Plugin export
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## 🤝 Contributing

Contributions welcome! Please ensure:
- Code follows existing patterns
- Tests pass (when implemented)
- TypeScript types are correct
- Documentation is updated

---

## 📄 License

MIT

---

## 🔗 Related

- **ElizaOS**: https://github.com/elizaos/eliza
- **Sendo Labs**: https://github.com/Sendo-labs

---

**Built with ❤️ by Sendo Labs**