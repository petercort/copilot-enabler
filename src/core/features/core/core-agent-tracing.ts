import { defineFeature } from '../definition';

export const coreAgentTracing = defineFeature({
  id: 'core-agent-tracing',
  name: 'OpenTelemetry Agent Tracing',
  category: 'Core',
  description:
    'Emit OpenTelemetry traces, metrics, and events for Copilot agent sessions so you can monitor latency, token usage, tool calls, and subagent activity in an OTLP-compatible backend.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/guides/monitoring-agents',
  detectHints: ['github.copilot.chat.otel.enabled', 'github.copilot.chat.otel.otlpEndpoint', 'invoke_agent'],
  impact: 'medium',
  difficulty: 'medium',
  setupSteps: [
    'Enable `github.copilot.chat.otel.enabled` in your VS Code settings.',
    'Set `github.copilot.chat.otel.otlpEndpoint` to your OpenTelemetry collector or OTLP-compatible backend.',
    'Run an agent session so Copilot emits `invoke_agent`, tool, and chat spans.',
    'Inspect the resulting traces in your observability backend to review latency and token usage.',
  ],
  addedIn: '1.119.0',
});
