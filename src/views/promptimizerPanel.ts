// Promptimizer Panel — prompt-context analysis dashboard.
// Renders the PromptimizerResult produced by src/core/promptimizer as a
// single scrolling webview with inline (hand-rolled) SVG charts.

import * as vscode from 'vscode';
import {
  Block,
  BlockCategory,
  Finding,
  IngestedSession,
  PromptimizerResult,
  QualityRisk,
} from '../core/promptimizer/types';
import { rateFor } from '../core/promptimizer/cost';

interface CategoryStyle {
  label: string;
  color: string;
  description: string;
}

const CATEGORY_STYLES: Record<BlockCategory, CategoryStyle> = {
  system: { label: 'System', color: '#3794ff', description: 'Base assistant instructions provided by the host (VS Code Copilot, CLI, etc.)' },
  custom_instruction: { label: 'Custom Instruction', color: '#4ec9b0', description: 'User/repo `copilot-instructions.md` content injected on every turn.' },
  skill: { label: 'Skill', color: '#c586c0', description: 'Tool/skill loadout from agent skills.' },
  agent: { label: 'Agent', color: '#ce9178', description: 'Agent system prompt + persona.' },
  sub_agent: { label: 'Sub-agent', color: '#dcdcaa', description: 'Spawned sub-agent prompts.' },
  mcp_tool: { label: 'MCP Tool', color: '#f14c4c', description: 'MCP tool schemas exposed to the model (often the largest dynamic block).' },
  built_in_tool: { label: 'Built-in Tool', color: '#b5cea8', description: 'Built-in tool schemas (read, edit, bash, etc.).' },
  user_message: { label: 'User Message', color: '#569cd6', description: 'User turn content.' },
  assistant_message: { label: 'Assistant Message', color: '#9cdcfe', description: 'Assistant reply text (no tool results).' },
  tool_result: { label: 'Tool Result', color: '#d7ba7d', description: 'Output returned from tool calls. Often the biggest churn source.' },
  attachment: { label: 'Attachment', color: '#a0a0a0', description: 'Files/images attached by the user.' },
  cache_control_overhead: { label: 'Cache-Control Overhead', color: '#d16969', description: 'Bytes spent on cache_control markers.' },
};

const CATEGORY_ORDER: BlockCategory[] = [
  'system',
  'custom_instruction',
  'skill',
  'agent',
  'sub_agent',
  'mcp_tool',
  'built_in_tool',
  'tool_result',
  'attachment',
  'user_message',
  'assistant_message',
  'cache_control_overhead',
];

interface Rect { x: number; y: number; w: number; h: number; }
interface TreemapItem { key: string; label: string; value: number; color: string; description: string; }
interface LaidItem extends Rect { item: TreemapItem; }

const TRIM_RULE = `When any tool result exceeds ~200 lines (≈3000 tokens), do the following BEFORE responding:
1. Summarize the relevant findings in ≤10 short bullets.
2. Discard the raw output from your context — do not quote it back.
3. Prefer reading files with bounded ranges:
   - Use \`view\` with \`view_range\` instead of full-file reads
   - Use \`grep\` with \`head_limit\` instead of dumping all matches
   - Use \`head -n\` / \`tail -n\` / \`rg --max-count\` to cap raw output
If a single read or grep produces more than 200 lines, narrow the query and try again instead of accepting the dump.`;

interface RuleGuide {
  title: string;
  why: string;
  howSteps: string[];
  copyText?: string;
  copyLabel?: string;
}

const RULE_GUIDES: Record<string, RuleGuide> = {
  'R-TR1': {
    title: 'Tool result oversize',
    why: 'Large tool results are re-sent on every subsequent turn, multiplying cost.',
    howSteps: [
      'Identify which tool emits big results from the Block-Level Actions table above.',
      'Request a <code>summary_only=true</code> argument or pipe through <code>head -n 200</code>.',
      'Add the hygiene rule below to <code>~/.copilot/copilot-instructions.md</code>.',
    ],
    copyText: TRIM_RULE,
    copyLabel: 'Copy hygiene snippet',
  },
  'R-BP1': {
    title: 'Boilerplate repeated',
    why: 'Repeated boilerplate inflates every turn; moving it to system context makes it free after the first cache hit.',
    howSteps: [
      'Move the repeated paragraph into <code>~/.copilot/copilot-instructions.md</code> once.',
      'Remove it from individual user messages going forward.',
    ],
    copyText: 'Move this paragraph into `copilot-instructions.md` at the top:\n\n<example placeholder>',
    copyLabel: 'Copy move hint',
  },
  'R-C1': {
    title: 'Cache-eligible stable prefix (short TTL)',
    why: 'A stable prefix that repeats across turns is an ideal candidate for Anthropic prompt caching (5-minute TTL).',
    howSteps: [
      'If you control the API call, set <code>cache_control: { type: &quot;ephemeral&quot; }</code> on the last block of the stable prefix.',
      'For a 5-minute session TTL, no extra configuration is needed; this is the default <code>ephemeral</code> tier.',
      'Edit your API call site or <code>~/.copilot/config.json</code> to add the marker.',
    ],
  },
  'R-C2': {
    title: 'Cache-eligible stable prefix (1-hour TTL)',
    why: 'A stable, long-lived prefix benefits from the 1-hour cache tier for cross-session savings.',
    howSteps: [
      'Set <code>cache_control: { type: &quot;ephemeral&quot;, ttl: &quot;1h&quot; }</code> on the last block of the stable prefix.',
      'Edit your API call site or <code>~/.copilot/config.json</code> to add the marker.',
    ],
  },
  'R-C3': {
    title: 'Cache-busting churn above stable prefix',
    why: 'Dynamic content before your stable prefix invalidates the cache on every turn.',
    howSteps: [
      'Identify which block is churning using the Block-Level Actions table above.',
      'Move dynamic content AFTER your stable prefix rather than before it.',
      'Or, if the dynamic block is optional, remove it from the prompt entirely.',
    ],
  },
  'R-C4': {
    title: 'Short cache TTL — promote to 1-hour',
    why: 'If the same prefix is reused across many sessions, a 1-hour TTL amortises the write cost better.',
    howSteps: [
      'Change your <code>cache_control</code> marker from <code>ephemeral</code> (5 min) to <code>{ type: &quot;ephemeral&quot;, ttl: &quot;1h&quot; }</code>.',
      'Edit your API call site or <code>~/.copilot/config.json</code>.',
    ],
  },
  'R-C5': {
    title: 'Cache prefix position suboptimal',
    why: 'The cache marker is placed too late in the prompt, excluding stable blocks from caching.',
    howSteps: [
      'Move the <code>cache_control</code> marker to the LAST block of the stable, high-token prefix.',
      'Everything BEFORE that marker will be cached; content after will remain uncached.',
    ],
  },
};

function sortSessionsDesc(sessions: IngestedSession[]): IngestedSession[] {
  return [...sessions].sort((a, b) => {
    if (!a.startedAt && !b.startedAt) { return 0; }
    if (!a.startedAt) { return 1; }
    if (!b.startedAt) { return -1; }
    return b.startedAt.localeCompare(a.startedAt);
  });
}

export class PromptimizerPanel {
  private static currentPanel: PromptimizerPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private result: PromptimizerResult | undefined;
  private currentSessionId: string | undefined;
  /** -1 = aggregate across all turns; otherwise 0-based index into session.turns. */
  private treemapTurn: number = -1;

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;

    this.panel.onDidDispose(
      () => {
        PromptimizerPanel.currentPanel = undefined;
        for (const d of this.disposables) {
          d.dispose();
        }
      },
      null,
      this.disposables,
    );

    this.panel.webview.onDidReceiveMessage(
      (message: { command: string; [k: string]: unknown }) => {
        this.handleMessage(message);
      },
      null,
      this.disposables,
    );
  }

  static show(extensionUri: vscode.Uri, result: PromptimizerResult): void {
    void extensionUri;
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (PromptimizerPanel.currentPanel) {
      PromptimizerPanel.currentPanel.panel.reveal(column);
      PromptimizerPanel.currentPanel.update(result);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'copilotEnablerPromptimizer',
      'Promptimizer — Prompt Context Analysis',
      column || vscode.ViewColumn.One,
      { enableScripts: true },
    );

    PromptimizerPanel.currentPanel = new PromptimizerPanel(panel);
    PromptimizerPanel.currentPanel.update(result);
  }

  private update(result: PromptimizerResult): void {
    this.result = result;
    const sorted = sortSessionsDesc(result.sessions);
    const sessionIds = sorted.map((s) => s.session_id);
    if (!this.currentSessionId || !sessionIds.includes(this.currentSessionId)) {
      this.currentSessionId = sorted[0]?.session_id;
      this.treemapTurn = -1;
    }
    this.render();
  }

  private render(): void {
    if (!this.result) { return; }
    this.panel.webview.html = this.getHtml(this.result);
  }

  private handleMessage(message: { command: string; [k: string]: unknown }): void {
    switch (message.command) {
      case 'selectSession': {
        const id = String(message.sessionId ?? '');
        if (id && this.result?.sessions.some((s) => s.session_id === id)) {
          this.currentSessionId = id;
          this.treemapTurn = -1;
          this.render();
        }
        return;
      }
      case 'selectTreemapTurn': {
        const t = Number(message.turn);
        if (Number.isFinite(t)) {
          this.treemapTurn = t;
          this.render();
        }
        return;
      }
      case 'copyPatch': {
        const idx = Number(message.findingId);
        const finding = this.result?.findings[idx];
        if (!finding) {
          vscode.window.showErrorMessage('Promptimizer: finding not found');
          return;
        }
        const payload = JSON.stringify(finding.patch ?? {}, null, 2);
        void vscode.env.clipboard.writeText(payload).then(() => {
          vscode.window.showInformationMessage('Patch copied');
        });
        return;
      }
      case 'copyText': {
        const text = typeof message.text === 'string' ? message.text : '';
        void vscode.env.clipboard.writeText(text).then(() => {
          vscode.window.showInformationMessage('Copied to clipboard');
        });
        return;
      }
      case 'implement': {
        vscode.commands.executeCommand('copilotEnabler.implement', { featureID: message.featureID });
        return;
      }
      case 'showMe': {
        vscode.commands.executeCommand('copilotEnabler.showMe', { featureID: message.featureID });
        return;
      }
      default:
        return;
    }
  }

  private getHtml(result: PromptimizerResult): string {
    const styles = sharedStyles();
    if (result.sessions.length === 0) {
      return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Promptimizer</title>${styles}</head>
<body>
  <h1>Promptimizer — Prompt Context Analysis</h1>
  <div class="empty-state">
    <p>No prompt sessions have been ingested yet.</p>
    <p>Run <strong>Copilot Enabler: Ingest Prompt Log</strong> from the command palette to load a <code>.jsonl</code> or <code>.har</code> capture, then re-open this view.</p>
  </div>
</body></html>`;
    }

    const session = result.sessions.find((s) => s.session_id === this.currentSessionId)
      ?? result.sessions[0];
    const model = session.model ?? result.model;

    const sessionSelector = this.renderSessionSelector(result.sessions);
    const summary = this.renderSummary(session, result);
    const tierBar = this.renderTierBreakdown(session, result);
    const stackedBar = this.renderStackedBar(session);
    const treemap = this.renderTreemap(session);
    const toolList = this.renderMcpToolList(session);
    const heatmapInsights = this.renderHeatmapInsights(session);
    const findings = this.renderFindings(result.findings);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Promptimizer — Prompt Context Analysis</title>
  ${styles}
</head>
<body>
  <div class="header">
    <h1>Promptimizer — Prompt Context Analysis</h1>
    <div class="header-meta">
      ${sessionSelector}
      <span class="model-badge" title="Pricing model used for estimates">${escapeHtml(model)}</span>
    </div>
  </div>

  <h2>Summary</h2>
  ${summary}

  <h2>Cost by Pricing Tier</h2>
  ${tierBar}

  <h2>Tokens by Turn (stacked by category)</h2>
  ${stackedBar}

  <h2>Category Treemap</h2>
  ${treemap}

  <h2>MCP Tools — Ranked by Tokens</h2>
  ${toolList}

  <h2>Block-Level Actions</h2>
  ${heatmapInsights}

  <h2>Findings</h2>
  ${findings}

  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-session-select]');
      if (sel) {
        vscode.postMessage({ command: 'selectSession', sessionId: sel.value });
        return;
      }
      const tm = e.target.closest('[data-treemap-select]');
      if (tm) {
        vscode.postMessage({ command: 'selectTreemapTurn', turn: Number(tm.value) });
        return;
      }
    });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-copy-patch]');
      if (btn) {
        e.preventDefault();
        vscode.postMessage({ command: 'copyPatch', findingId: Number(btn.dataset.copyPatch) });
        return;
      }
      const cb = e.target.closest('[data-copy-text]');
      if (cb) {
        e.preventDefault();
        vscode.postMessage({ command: 'copyText', text: cb.dataset.copyText });
      }
    });

    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'hover-tooltip';
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);
    document.addEventListener('mousemove', (e) => {
      const t = e.target.closest('[data-tooltip]');
      if (t) {
        tooltipEl.textContent = t.getAttribute('data-tooltip');
        tooltipEl.style.display = 'block';
        tooltipEl.style.left = (e.clientX + 12) + 'px';
        tooltipEl.style.top = (e.clientY + 12) + 'px';
      } else {
        tooltipEl.style.display = 'none';
      }
    });
    document.addEventListener('mouseleave', () => { tooltipEl.style.display = 'none'; });
  </script>
</body>
</html>`;
  }

  private renderSessionSelector(sessions: IngestedSession[]): string {
    const sorted = sortSessionsDesc(sessions);
    if (sorted.length <= 1) {
      const s = sorted[0];
      const label = s.label ?? s.session_id;
      return `<span class="session-label">Session: <code>${escapeHtml(label)}</code> · ${s.turns.length} turns</span>`;
    }
    const options = sorted
      .map((s) => {
        const sel = s.session_id === this.currentSessionId ? ' selected' : '';
        const label = s.label ?? s.session_id;
        return `<option value="${escapeHtml(s.session_id)}"${sel}>${escapeHtml(label)} (${s.turns.length} turns)</option>`;
      })
      .join('');
    return `<label class="session-label">Session: <select data-session-select>${options}</select></label>`;
  }

  private renderSummary(session: IngestedSession, result: PromptimizerResult): string {
    const stats = computeSessionStats(session);
    const model = session.model ?? result.model;
    const turns = session.turns.length || 1;
    const authoritative = session.usage;

    let totalTokensDisplay = stats.totalTokens;
    let currentSessionCost = 0;
    let afterCost = 0;
    const turnCount = session.turns.length || 1;
    try {
      const freshRate = rateFor(result.model, 'fresh');
      if (authoritative) {
        totalTokensDisplay = authoritative.inputUncached + authoritative.cacheWrite + authoritative.cacheRead + authoritative.output;
        currentSessionCost =
          (authoritative.inputUncached * freshRate
            + authoritative.cacheWrite * rateFor(result.model, 'write5m')
            + authoritative.cacheRead * rateFor(result.model, 'read'))
          / 1_000_000;
      } else {
        currentSessionCost = (stats.totalTokens * freshRate) / 1_000_000;
      }
      const cachingFindings = result.findings.filter((f) => f.category === 'caching');
      const savingsPerSession = cachingFindings.reduce(
        (s, f) => s + ((f.estimated_savings?.usd_per_100_turns ?? 0) / 100 * turnCount),
        0,
      );
      afterCost = Math.max(0, currentSessionCost - savingsPerSession);
    } catch {
      currentSessionCost = 0;
      afterCost = 0;
    }

    const stablePct = stats.totalTokens > 0
      ? Math.round((stats.stableTokens / stats.totalTokens) * 100)
      : 0;
    const variablePct = 100 - stablePct;
    const totalLabel = authoritative
      ? `Total tokens · ${turns} turn(s) · ${escapeHtml(model)} · real API usage`
      : `Total tokens · ${turns} turn(s) · ${escapeHtml(model)} · heuristic`;

    return `<div class="scorecard">
      <div class="score-card">
        <div class="value">${formatNumber(totalTokensDisplay)}</div>
        <div class="label">${totalLabel}</div>
      </div>
      <div class="score-card">
        <div class="value">${stablePct}% / ${variablePct}%</div>
        <div class="label">Stable vs variable tokens (blocks)</div>
      </div>
      <div class="score-card">
        <div class="value">$${currentSessionCost.toFixed(4)}</div>
        <div class="label">This session cost (est.)</div>
      </div>
      <div class="score-card">
        <div class="value">$${afterCost.toFixed(4)}</div>
        <div class="label">After caching recs (est.)</div>
      </div>
      <div class="score-card">
        <div class="value">${result.findings.length}</div>
        <div class="label">Findings</div>
      </div>
    </div>`;
  }

  private renderTierBreakdown(session: IngestedSession, result: PromptimizerResult): string {
    const model = result.model;
    const authoritative = session.usage;
    const tiers = authoritative
      ? { fresh: authoritative.inputUncached, cacheWrite: authoritative.cacheWrite, cacheRead: authoritative.cacheRead, output: authoritative.output }
      : computeTierBreakdown(session);
    const entries: Array<{ key: 'fresh' | 'write' | 'read' | 'output'; label: string; color: string; tokens: number; usd: number; desc: string }> = [
      { key: 'fresh',  label: 'Fresh input',  color: '#569cd6', tokens: tiers.fresh,      usd: (tiers.fresh      * rateFor(model, 'fresh'))   / 1_000_000, desc: 'Input tokens sent uncached (standard rate).' },
      { key: 'write',  label: 'Cache write',  color: '#d7ba7d', tokens: tiers.cacheWrite, usd: (tiers.cacheWrite * rateFor(model, 'write5m')) / 1_000_000, desc: 'First-time cached blocks (1.25× fresh rate). One-time cost per cache entry.' },
      { key: 'read',   label: 'Cache read',   color: '#4ec9b0', tokens: tiers.cacheRead,  usd: (tiers.cacheRead  * rateFor(model, 'read'))    / 1_000_000, desc: 'Reused cached blocks (0.1× fresh rate). Big savings here.' },
      { key: 'output', label: 'Output',       color: '#c586c0', tokens: tiers.output,     usd: 0, desc: 'Assistant-generated tokens. Output pricing is not modeled in this estimate.' },
    ];
    const total = entries.reduce((s, e) => s + e.tokens, 0);
    if (total <= 0) {
      return '<p class="empty-inline">No tokens to break down.</p>';
    }
    const width = 520;
    const height = 36;
    let x = 0;
    const segs = entries.map((e) => {
      if (e.tokens <= 0) { return ''; }
      const w = (e.tokens / total) * width;
      const tip = `${e.label} — ${formatNumber(e.tokens)} tokens (${((e.tokens / total) * 100).toFixed(1)}%) · ~$${e.usd.toFixed(4)}\n${e.desc}`;
      const rect = `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" fill="${e.color}" class="sb-rect" data-tooltip="${escapeHtml(tip)}"><title>${escapeHtml(tip)}</title></rect>`;
      x += w;
      return rect;
    }).join('');
    const legend = entries.map((e) => {
      const pct = total > 0 ? ((e.tokens / total) * 100).toFixed(1) : '0.0';
      return `<span class="legend-item" title="${escapeHtml(e.desc)}"><span class="legend-swatch" style="background:${e.color}"></span>${escapeHtml(e.label)} · ${formatNumber(e.tokens)} (${pct}%)</span>`;
    }).join('');
    const sourceLabel = authoritative
      ? authoritative.source === 'shutdown-event'
        ? `Authoritative: from <code>session.shutdown</code> modelMetrics in <code>events.jsonl</code>.`
        : authoritative.source === 'vscode-debug-log'
          ? `Authoritative: from VS Code <code>debug-logs/main.jsonl</code> llm_request spans.`
          : `Authoritative: summed from ${authoritative.apiCalls} <code>assistant_usage</code> telemetry events in <code>~/.copilot/logs/process-*.log</code>.`
      : 'Heuristic fallback: no debug-log telemetry found for this session. Derived from block categories and <code>cache_control</code> markers.';
    const premiumNote = session.premiumRequests !== undefined
      ? ` Premium requests: ${session.premiumRequests}.`
      : '';
    const note = `<p class="muted">${sourceLabel}${premiumNote}</p>`;
    return `<div class="chart-wrap tier-wrap">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Token breakdown by pricing tier" preserveAspectRatio="none">${segs}</svg>
      <div class="legend">${legend}</div>
      ${note}
    </div>`;
  }

  private renderStackedBar(session: IngestedSession): string {
    const turns = session.turns;
    if (turns.length === 0) {
      return '<p class="empty-inline">No turns in this session.</p>';
    }
    const width = 760;
    const height = 260;
    const padL = 48;
    const padR = 16;
    const padT = 16;
    const padB = 40;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const perTurn: Array<Partial<Record<BlockCategory, number>>> = turns.map((t) => {
      const acc: Partial<Record<BlockCategory, number>> = {};
      for (const b of t.blocks) {
        acc[b.category] = (acc[b.category] ?? 0) + (b.tokens ?? 0);
      }
      return acc;
    });
    const turnTotals = perTurn.map((m) => Object.values(m).reduce<number>((s, v) => s + (v ?? 0), 0));
    const maxTotal = Math.max(1, ...turnTotals);

    const barGap = Math.max(2, Math.min(10, Math.floor(innerW / turns.length / 4)));
    const barW = Math.max(4, (innerW - barGap * (turns.length - 1)) / turns.length);

    const bars: string[] = [];
    turns.forEach((turn, i) => {
      const x = padL + i * (barW + barGap);
      let yOffset = 0;
      for (const cat of CATEGORY_ORDER) {
        const tokens = perTurn[i][cat] ?? 0;
        if (tokens <= 0) { continue; }
        const h = (tokens / maxTotal) * innerH;
        const y = padT + innerH - yOffset - h;
        const style = CATEGORY_STYLES[cat];
        const tooltipText = `${style.label} — ${formatNumber(tokens)} tokens (turn ${turn.turn})`;
        bars.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" fill="${style.color}" class="sb-rect" data-tooltip="${escapeHtml(tooltipText)}"><title>${escapeHtml(tooltipText)}</title></rect>`);
        yOffset += h;
      }
    });

    // axes
    const ticks: string[] = [];
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
      const v = (maxTotal * i) / tickCount;
      const y = padT + innerH - (v / maxTotal) * innerH;
      ticks.push(`<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" class="grid-line" />`);
      ticks.push(`<text x="${padL - 6}" y="${y + 3}" class="axis-label" text-anchor="end">${formatNumber(Math.round(v))}</text>`);
    }
    const xLabels: string[] = [];
    const step = Math.max(1, Math.ceil(turns.length / 10));
    turns.forEach((turn, i) => {
      if (i % step !== 0 && i !== turns.length - 1) { return; }
      const cx = padL + i * (barW + barGap) + barW / 2;
      xLabels.push(`<text x="${cx}" y="${padT + innerH + 16}" class="axis-label" text-anchor="middle">${turn.turn}</text>`);
    });
    xLabels.push(`<text x="${padL + innerW / 2}" y="${height - 4}" class="axis-label" text-anchor="middle">turn</text>`);

    const legend = CATEGORY_ORDER.map((cat) => {
      const s = CATEGORY_STYLES[cat];
      return `<span class="legend-item" title="${escapeHtml(s.description)}"><span class="legend-swatch" style="background:${s.color}"></span>${escapeHtml(s.label)}</span>`;
    }).join('');

    return `<div class="chart-wrap">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Stacked bar chart of tokens per turn by category">
        ${ticks.join('')}
        ${bars.join('')}
        ${xLabels.join('')}
      </svg>
      <div class="legend">${legend}</div>
    </div>`;
  }

  private renderTreemap(session: IngestedSession): string {
    const turns = session.turns;
    const options: string[] = [];
    options.push(`<option value="-1"${this.treemapTurn === -1 ? ' selected' : ''}>Session aggregate</option>`);
    for (let i = 0; i < turns.length; i++) {
      const sel = this.treemapTurn === i ? ' selected' : '';
      options.push(`<option value="${i}"${sel}>Turn ${turns[i].turn}</option>`);
    }

    const selectedBlocks: Block[] = this.treemapTurn === -1
      ? turns.flatMap((t) => t.blocks)
      : (turns[this.treemapTurn]?.blocks ?? []);

    const totals = new Map<BlockCategory, number>();
    for (const b of selectedBlocks) {
      totals.set(b.category, (totals.get(b.category) ?? 0) + (b.tokens ?? 0));
    }
    const totalTokens = Array.from(totals.values()).reduce((s, v) => s + v, 0);
    const items: TreemapItem[] = [];
    for (const [cat, v] of totals.entries()) {
      if (v <= 0) { continue; }
      items.push({ key: cat, label: CATEGORY_STYLES[cat].label, value: v, color: CATEGORY_STYLES[cat].color, description: CATEGORY_STYLES[cat].description });
    }

    const width = 520;
    const height = 220;
    const selector = `<label class="inline-label">View: <select data-treemap-select>${options.join('')}</select></label>`;
    if (items.length === 0 || totalTokens === 0) {
      return `<div class="chart-wrap">${selector}<p class="empty-inline">No tokens to display for this selection.</p></div>`;
    }
    const laid = squarify(items, { x: 0, y: 0, w: width, h: height });
    const rects = laid.map((r) => {
      const pct = (r.item.value / totalTokens) * 100;
      const title = `${r.item.label}: ${formatNumber(r.item.value)} tokens (${pct.toFixed(1)}%)`;
      const labelText = `${r.item.label} · ${formatNumber(r.item.value)}`;
      const showText = r.w > 60 && r.h > 18;
      const text = showText
        ? `<text x="${r.x + 6}" y="${r.y + 16}" class="tm-label">${escapeHtml(labelText)}</text>`
        : '';
      return `<g><rect x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}" fill="${r.item.color}" class="tm-rect" data-tooltip="${escapeHtml(title)}"><title>${escapeHtml(title)}</title></rect>${text}</g>`;
    }).join('');

    return `<div class="chart-wrap">
      ${selector}
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Treemap of tokens by category">
        ${rects}
      </svg>
    </div>`;
  }

  private renderMcpToolList(session: IngestedSession): string {
    interface Row { server: string; name: string; tokens: number; allStable: boolean; count: number; }
    const byKey = new Map<string, Row>();
    for (const turn of session.turns) {
      for (const b of turn.blocks) {
        if (b.category !== 'mcp_tool') { continue; }
        const server = b.server ?? '(unknown)';
        const name = b.name ?? '(unnamed)';
        const key = `${server}::${name}`;
        const existing = byKey.get(key);
        const tokens = b.tokens ?? 0;
        const isStable = b.stable === true;
        if (existing) {
          existing.tokens += tokens;
          existing.count += 1;
          existing.allStable = existing.allStable && isStable;
        } else {
          byKey.set(key, { server, name, tokens, allStable: isStable, count: 1 });
        }
      }
    }
    const rows = Array.from(byKey.values()).sort((a, b) => b.tokens - a.tokens);
    if (rows.length === 0) {
      return '<p class="empty-inline">No MCP tool blocks in this session.</p>';
    }
    const body = rows.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.server)}</code></td>
        <td><code>${escapeHtml(r.name)}</code></td>
        <td class="num">${formatNumber(r.tokens)}</td>
        <td class="num">${r.count}</td>
        <td>${r.allStable ? '<span class="badge badge-stable">stable</span>' : '<span class="badge badge-variable">variable</span>'}</td>
      </tr>`).join('');
    return `<table class="data-table">
      <thead><tr><th>Server</th><th>Tool</th><th class="num">Tokens</th><th class="num">Occurrences</th><th>Stability</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  }

  private renderHeatmapInsights(session: IngestedSession): string {
    const turns = session.turns;
    const totalTurns = turns.length;
    if (totalTurns === 0) {
      return '<p class="empty-inline">No turns to analyse.</p>';
    }

    interface BlockStat {
      id: string;
      category: BlockCategory;
      displayName: string;
      tokens: number;
      maxStableRun: number;
      occurrences: number;
      changes: number;
      sampleText: string;
    }
    const stats = new Map<string, BlockStat>();
    let prevHashes = new Map<string, string>();
    const trailingStable = new Map<string, number>();
    const maxStable = new Map<string, number>();

    for (let ti = 0; ti < turns.length; ti++) {
      const turn = turns[ti];
      const seenThisTurn = new Set<string>();
      for (const b of turn.blocks) {
        seenThisTurn.add(b.id);
        let s = stats.get(b.id);
        if (!s) {
          s = {
            id: b.id, category: b.category, displayName: b.name ?? b.id,
            tokens: b.tokens ?? 0, maxStableRun: 0, occurrences: 0, changes: 0,
            sampleText: b.text ?? '',
          };
          stats.set(b.id, s);
        }
        s.occurrences++;
        if (b.tokens && b.tokens > s.tokens) { s.tokens = b.tokens; }
        if (!s.sampleText && b.text) { s.sampleText = b.text; }
        const isStable = ti > 0 && prevHashes.get(b.id) === b.hash && b.hash !== undefined;
        if (isStable) {
          const t = (trailingStable.get(b.id) ?? 0) + 1;
          trailingStable.set(b.id, t);
          if (t > (maxStable.get(b.id) ?? 0)) { maxStable.set(b.id, t); }
        } else {
          if (ti > 0 && prevHashes.has(b.id)) { s.changes++; }
          trailingStable.set(b.id, 0);
        }
      }
      for (const id of Array.from(trailingStable.keys())) {
        if (!seenThisTurn.has(id)) { trailingStable.set(id, 0); }
      }
      prevHashes = new Map(turn.blocks.map((b) => [b.id, b.hash ?? '']));
    }
    for (const [id, s] of stats) {
      s.maxStableRun = Math.max(maxStable.get(id) ?? 0, trailingStable.get(id) ?? 0);
    }

    interface Action {
      kind: 'cache' | 'move' | 'trim' | 'system';
      icon: string;
      title: string;
      why: string;
      howSteps: string[];     // ordered steps shown as <ol>
      copyText?: string;      // text shown in <pre> with a Copy button
      copyLabel?: string;     // label for the Copy button
      score: number;
    }
    const actions: Action[] = [];

    const CACHE_PREFIX_RULE = `When the same context is needed across many turns, place it ONCE at the top of the conversation as system or custom-instruction content rather than re-pasting it inside each user message. This lets the model provider cache it (~10× cheaper after the first hit).`;

    // 1) Cache candidates
    for (const s of stats.values()) {
      if (s.maxStableRun >= 2 && s.tokens >= 200 &&
          (s.category === 'system' || s.category === 'mcp_tool' || s.category === 'built_in_tool' || s.category === 'custom_instruction' || s.category === 'skill')) {
        actions.push({
          kind: 'cache',
          icon: '🔒',
          title: `Make the stable ${categoryShort(s.category)} prefix cache-friendly (${formatNumber(s.tokens)} tokens, stable ${s.maxStableRun + 1} turns)`,
          why: `Block <code>${escapeHtml(s.id)}</code> repeats verbatim across ${s.maxStableRun + 1} consecutive turns.`,
          howSteps: [
            `If you control the Anthropic API call, set <code>cache_control: { type: "ephemeral" }</code> on the LAST block of this stable prefix.`,
            `If you're using Copilot CLI / Chat (no API access), reduce churn ABOVE this prefix instead — disable verbose <code>&lt;reminder&gt;</code> blocks and trim oversized tool results so the cache isn't busted on every turn.`,
            `Verify by re-running <em>Copilot Enabler: Analyze</em> after a few new turns — the heatmap row should stay grey.`,
          ],
          score: s.tokens * (s.maxStableRun + 1),
        });
      }
    }

    // 2) Cache busters
    for (const s of stats.values()) {
      if (s.changes >= Math.max(2, Math.floor(totalTurns * 0.5)) &&
          s.tokens >= 50 && s.tokens <= 500 &&
          (s.category === 'system' || s.category === 'mcp_tool' || s.category === 'built_in_tool')) {
        actions.push({
          kind: 'move',
          icon: '↪️',
          title: `Stop sending the churning ${categoryShort(s.category)} block <code>${escapeHtml(s.displayName)}</code> on every turn`,
          why: `Changes on ${s.changes}/${totalTurns - 1} turns — every change invalidates the cache for everything before it.`,
          howSteps: [
            `If this block is an MCP tool you don't use every turn, remove the server from <code>mcp.json</code> for sessions where you don't need it.`,
            `If it's a dynamic system field (timestamp, working directory), move it AFTER your stable system prompt instead of before.`,
            `For Copilot CLI: open <code>~/.copilot/config.json</code> and prune unused plugins; this drops their tool definitions from your context.`,
          ],
          score: s.tokens * s.changes,
        });
      }
    }

    // 3) Tool-result bloat — concrete custom instruction
    const bloated = Array.from(stats.values()).filter((s) => s.category === 'tool_result' && s.tokens >= 3000);
    if (bloated.length > 0) {
      const total = bloated.reduce((t, s) => t + s.tokens, 0);
      const max = Math.max(...bloated.map((s) => s.tokens));
      actions.push({
        kind: 'trim',
        icon: '✂️',
        title: `Stop bloating context with ${bloated.length} oversized tool result(s) (largest: ${formatNumber(max)} tokens)`,
        why: `Once a tool result lands in history, it's re-sent on every later turn. The ${bloated.length} hits in this session add ${formatNumber(total)} tokens × every remaining turn.`,
        howSteps: [
          `Add the snippet below to <code>~/.copilot/copilot-instructions.md</code> (create the file if missing) so future sessions auto-summarize big tool dumps.`,
          `Also add it to <code>.github/copilot-instructions.md</code> in projects where you want the rule per-repo.`,
          `Want a real-time warning the moment a tool result crosses the threshold? Run <strong>Copilot Enabler: Promptimizer — Watch for Large Tool Results</strong>.`,
        ],
        copyText: TRIM_RULE,
        copyLabel: 'Copy custom-instruction snippet',
        score: total,
      });
    }

    // 4) Promote repeated user content
    const userBlocks = Array.from(stats.values()).filter((s) => s.category === 'user_message');
    for (const s of userBlocks) {
      if (s.maxStableRun >= 2 && s.tokens >= 150) {
        const sample = s.sampleText.split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 80)
          .sort((a, b) => b.length - a.length)[0] ?? s.sampleText.slice(0, 800);
        actions.push({
          kind: 'system',
          icon: '⬆️',
          title: `Promote repeated user content (${formatNumber(s.tokens)} tokens × ${s.maxStableRun + 1} turns) to a cached system prompt`,
          why: `You're pasting the same paragraph into every turn — that's pure waste. Move it once, save it forever.`,
          howSteps: [
            `Open <code>~/.copilot/copilot-instructions.md</code> (or your project's <code>.github/copilot-instructions.md</code>).`,
            `Paste the snippet below at the bottom.`,
            `Stop including this text inline in your messages — Copilot will pick it up automatically as system context.`,
            CACHE_PREFIX_RULE,
          ],
          copyText: sample.slice(0, 1500),
          copyLabel: 'Copy boilerplate to promote',
          score: s.tokens * (s.maxStableRun + 1),
        });
      }
    }

    if (actions.length === 0) {
      return `<p class="empty-inline">No specific block-level actions for this session — no stable prefix worth caching, no oversized tool results, and no obvious cache-busters. The Findings table below covers session-wide opportunities. Want a real-time warning when a tool result blows up? Run <strong>Copilot Enabler: Promptimizer — Watch for Large Tool Results</strong>.</p>`;
    }

    actions.sort((a, b) => b.score - a.score);
    const items = actions.slice(0, 6).map((a, idx) => {
      const steps = a.howSteps.map((step) => `<li>${step}</li>`).join('');
      const copy = a.copyText
        ? `<div class="insight-copy">
            <pre class="copy-block" id="copy-${idx}">${escapeHtml(a.copyText)}</pre>
            <button class="copy-btn" data-copy-text="${escapeHtml(a.copyText)}">${escapeHtml(a.copyLabel ?? 'Copy')}</button>
          </div>`
        : '';
      return `<li class="insight-item insight-${a.kind}">
        <span class="insight-icon" aria-hidden="true">${a.icon}</span>
        <div class="insight-body">
          <div class="insight-title">${a.title}</div>
          <div class="insight-why">${a.why}</div>
          <details class="insight-fix">
            <summary>How to fix</summary>
            <ol class="insight-steps">${steps}</ol>
            ${copy}
          </details>
        </div>
      </li>`;
    }).join('');
    const more = actions.length > 6 ? `<p class="muted">+${actions.length - 6} lower-impact actions hidden.</p>` : '';
    return `<ul class="insights">${items}</ul>${more}`;
  }

  private renderFindings(findings: Finding[]): string {
    if (findings.length === 0) {
      return '<p class="empty-inline">No findings. Nothing to optimize — nice work!</p>';
    }

    interface GroupedRule {
      rule: string;
      category: Finding['category'];
      worstRisk: QualityRisk;
      count: number;
      totalTokens: number;
      totalSavings: number;
      blockFreq: Map<string, number>;
      patchFindingIdxs: number[];
    }

    const riskOrder: QualityRisk[] = ['high', 'medium', 'low', 'none'];
    const worstRisk = (a: QualityRisk, b: QualityRisk): QualityRisk =>
      riskOrder.indexOf(a) <= riskOrder.indexOf(b) ? a : b;

    const groups = new Map<string, GroupedRule>();
    findings.forEach((f, idx) => {
      let g = groups.get(f.rule);
      if (!g) {
        g = {
          rule: f.rule,
          category: f.category,
          worstRisk: f.quality_risk,
          count: 0,
          totalTokens: 0,
          totalSavings: 0,
          blockFreq: new Map(),
          patchFindingIdxs: [],
        };
        groups.set(f.rule, g);
      }
      g.count++;
      g.totalTokens += f.evidence?.tokens ?? 0;
      g.totalSavings += f.estimated_savings?.usd_per_100_turns ?? 0;
      g.worstRisk = worstRisk(g.worstRisk, f.quality_risk);
      for (const b of (f.evidence?.blocks ?? [])) {
        g.blockFreq.set(b, (g.blockFreq.get(b) ?? 0) + 1);
      }
      if (f.patch) { g.patchFindingIdxs.push(idx); }
    });

    const sorted = Array.from(groups.values())
      .sort((a, b) => b.totalSavings - a.totalSavings || b.count - a.count);

    const rows = sorted.map((g, rowIdx) => {
      const guide: RuleGuide = RULE_GUIDES[g.rule] ?? {
        title: g.rule,
        why: findings.find((f) => f.rule === g.rule)?.message ?? '',
        howSteps: ['See finding evidence and patch.'],
      };

      const topBlocks = Array.from(g.blockFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([b]) => `<code>${escapeHtml(b)}</code>`)
        .join(' ');

      const steps = guide.howSteps.map((step) => `<li>${step}</li>`).join('');
      const copySnippet = guide.copyText
        ? `<div class="insight-copy">
            <pre class="copy-block" id="rule-copy-${rowIdx}">${escapeHtml(guide.copyText)}</pre>
            <button class="copy-btn" data-copy-text="${escapeHtml(guide.copyText)}">${escapeHtml(guide.copyLabel ?? 'Copy fix snippet')}</button>
          </div>`
        : '';
      const patchBtns = g.patchFindingIdxs
        .map((pidx) => `<button class="copy-btn" data-copy-patch="${pidx}">Copy patch</button>`)
        .join(' ');

      return `<tr class="rule-row">
        <td>
          <details class="rule-row-detail">
            <summary><code>${escapeHtml(g.rule)}</code> — ${escapeHtml(guide.title)}</summary>
            <div class="rule-howto">
              ${guide.why ? `<div class="rule-why">${escapeHtml(guide.why)}</div>` : ''}
              <ol class="rule-howto-steps">${steps}</ol>
              ${copySnippet}
              ${patchBtns}
            </div>
          </details>
        </td>
        <td>${escapeHtml(g.category)}</td>
        <td><span class="badge badge-risk-${g.worstRisk}">${escapeHtml(g.worstRisk)}</span></td>
        <td class="num">${g.count}</td>
        <td class="num">$${g.totalSavings.toFixed(2)}</td>
        <td>${topBlocks}${g.totalTokens > 0 ? `<div class="muted">${formatNumber(g.totalTokens)} tokens</div>` : ''}</td>
      </tr>`;
    }).join('');

    return `<table class="data-table findings-table">
      <thead><tr><th>Rule</th><th>Category</th><th>Quality risk</th><th class="num">Count</th><th class="num">$ saved/100 turns</th><th>Top blocks</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }
}

// --- helpers ---------------------------------------------------------------

interface SessionStats {
  totalTokens: number;
  stableTokens: number;
}

function computeSessionStats(session: IngestedSession): SessionStats {
  let total = 0;
  let stable = 0;
  for (const turn of session.turns) {
    for (const b of turn.blocks) {
      const t = b.tokens ?? 0;
      total += t;
      if (b.stable === true) { stable += t; }
    }
  }
  return { totalTokens: total, stableTokens: stable };
}

interface TierBreakdown {
  fresh: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

function computeTierBreakdown(session: IngestedSession): TierBreakdown {
  const out: TierBreakdown = { fresh: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  const seenCached = new Set<string>();
  for (const turn of session.turns) {
    for (const b of turn.blocks) {
      const tokens = b.tokens ?? 0;
      if (tokens <= 0) { continue; }
      if (b.category === 'assistant_message') {
        out.output += tokens;
        continue;
      }
      if (b.cache_control) {
        if (seenCached.has(b.id)) {
          out.cacheRead += tokens;
        } else {
          out.cacheWrite += tokens;
          seenCached.add(b.id);
        }
      } else {
        out.fresh += tokens;
      }
    }
  }
  return out;
}

function categoryShort(cat: BlockCategory): string {
  return CATEGORY_STYLES[cat].label;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) { return '0'; }
  return Math.round(n).toLocaleString('en-US');
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- squarified treemap ----------------------------------------------------

function squarify(items: TreemapItem[], rect: Rect): LaidItem[] {
  const clean = items.filter((i) => i.value > 0).slice().sort((a, b) => b.value - a.value);
  const total = clean.reduce((s, i) => s + i.value, 0);
  const out: LaidItem[] = [];
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) { return out; }
  const area = rect.w * rect.h;
  const scaled = clean.map((i) => ({ item: i, scaledValue: (i.value * area) / total }));
  squarifyStep(scaled, [], rect, out);
  return out;
}

interface ScaledItem { item: TreemapItem; scaledValue: number; }

function squarifyStep(children: ScaledItem[], row: ScaledItem[], rect: Rect, out: LaidItem[]): void {
  if (children.length === 0) {
    layoutRow(row, rect, out);
    return;
  }
  const w = Math.min(rect.w, rect.h);
  const head = children[0];
  const newRow = row.concat(head);
  if (row.length === 0 || worst(row, w) >= worst(newRow, w)) {
    squarifyStep(children.slice(1), newRow, rect, out);
  } else {
    const newRect = layoutRow(row, rect, out);
    squarifyStep(children, [], newRect, out);
  }
}

function worst(row: ScaledItem[], w: number): number {
  if (row.length === 0) { return Infinity; }
  let sum = 0; let rmax = -Infinity; let rmin = Infinity;
  for (const r of row) {
    sum += r.scaledValue;
    if (r.scaledValue > rmax) { rmax = r.scaledValue; }
    if (r.scaledValue < rmin) { rmin = r.scaledValue; }
  }
  if (sum <= 0 || rmin <= 0) { return Infinity; }
  const w2 = w * w;
  const s2 = sum * sum;
  return Math.max((w2 * rmax) / s2, s2 / (w2 * rmin));
}

function layoutRow(row: ScaledItem[], rect: Rect, out: LaidItem[]): Rect {
  if (row.length === 0) { return rect; }
  const sum = row.reduce((a, b) => a + b.scaledValue, 0);
  if (rect.w >= rect.h) {
    const colW = sum / rect.h;
    let y = rect.y;
    for (const r of row) {
      const h = r.scaledValue / colW;
      out.push({ x: rect.x, y, w: colW, h, item: r.item });
      y += h;
    }
    return { x: rect.x + colW, y: rect.y, w: rect.w - colW, h: rect.h };
  }
  const rowH = sum / rect.w;
  let x = rect.x;
  for (const r of row) {
    const w = r.scaledValue / rowH;
    out.push({ x, y: rect.y, w, h: rowH, item: r.item });
    x += w;
  }
  return { x: rect.x, y: rect.y + rowH, w: rect.w, h: rect.h - rowH };
}

// --- styles ----------------------------------------------------------------

function sharedStyles(): string {
  return `<style>
    body {
      font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
      color: var(--vscode-foreground, #cccccc);
      background: var(--vscode-editor-background, #1e1e1e);
      padding: 20px;
      max-width: 1100px;
      margin: 0 auto;
    }
    h1 { border-bottom: 2px solid var(--vscode-panel-border, #444); padding-bottom: 8px; margin: 0 0 8px 0; }
    h2 { margin-top: 32px; color: var(--vscode-textLink-foreground, #3794ff); }
    .header { display: flex; flex-direction: column; gap: 8px; }
    .header-meta { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    .session-label { font-size: 0.9em; opacity: 0.9; }
    .session-label select {
      background: var(--vscode-dropdown-background, #3c3c3c);
      color: var(--vscode-dropdown-foreground, #f0f0f0);
      border: 1px solid var(--vscode-dropdown-border, #444);
      border-radius: 4px;
      padding: 2px 6px;
      font-family: inherit;
    }
    .model-badge {
      padding: 2px 10px;
      border-radius: 10px;
      background: var(--vscode-editor-inactiveSelectionBackground, #264f78);
      color: var(--vscode-foreground, #cccccc);
      font-size: 0.85em;
    }
    .scorecard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin: 20px 0;
    }
    .score-card {
      background: var(--vscode-editor-inactiveSelectionBackground, #264f78);
      border-radius: 8px;
      padding: 14px 14px;
      text-align: center;
    }
    .score-card .value {
      font-size: 1.6em;
      font-weight: bold;
      color: var(--vscode-textLink-foreground, #3794ff);
    }
    .score-card .label { font-size: 0.8em; opacity: 0.8; margin-top: 4px; }
    .chart-wrap { margin: 12px 0 8px 0; overflow-x: auto; }
    .chart-wrap svg { display: block; max-width: 100%; height: auto; }
    .inline-label { display: inline-block; margin-bottom: 8px; font-size: 0.9em; opacity: 0.9; }
    .inline-label select {
      background: var(--vscode-dropdown-background, #3c3c3c);
      color: var(--vscode-dropdown-foreground, #f0f0f0);
      border: 1px solid var(--vscode-dropdown-border, #444);
      border-radius: 4px;
      padding: 2px 6px;
      font-family: inherit;
      margin-left: 4px;
    }
    .axis-label { fill: var(--vscode-foreground, #cccccc); font-size: 10px; opacity: 0.75; }
    .grid-line { stroke: var(--vscode-panel-border, #444); stroke-width: 1; opacity: 0.35; }
    .tm-rect { stroke: var(--vscode-editor-background, #1e1e1e); stroke-width: 1; cursor: help; }
    .sb-rect { cursor: help; }
    .hover-tooltip {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      background: var(--vscode-editorHoverWidget-background, #252526);
      color: var(--vscode-editorHoverWidget-foreground, #cccccc);
      border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
      padding: 4px 8px;
      font-size: 12px;
      border-radius: 3px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      max-width: 320px;
    }
    .tm-label { fill: #111; font-size: 11px; font-weight: 600; pointer-events: none; }
    .legend {
      display: flex; flex-wrap: wrap; gap: 10px 14px; margin: 10px 0 4px 0; font-size: 0.8em;
    }
    .legend-item { display: inline-flex; align-items: center; gap: 5px; cursor: help; }
    .legend-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; }
    .legend-inline { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: middle; margin: 0 2px; }
    .section-intro { font-size: 0.9em; opacity: 0.85; margin: 4px 0 12px 0; line-height: 1.5; }
    .subsection { margin: 18px 0 6px 0; font-size: 1em; opacity: 0.85; }
    .insights { list-style: none; padding: 0; margin: 6px 0 14px 0; }
    .insight-item {
      display: flex; gap: 10px; padding: 10px 12px; margin-bottom: 6px;
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(120,120,120,0.08));
      border-radius: 4px;
    }
    .insight-cache { border-left-color: #4caf50; }
    .insight-move  { border-left-color: #ffb84d; }
    .insight-trim  { border-left-color: #f14c4c; }
    .insight-system { border-left-color: #9c64ff; }
    .insight-icon { font-size: 1.2em; line-height: 1.4; }
    .insight-title { font-weight: 600; margin-bottom: 2px; }
    .insight-detail { font-size: 0.88em; opacity: 0.92; line-height: 1.45; }
    .insight-detail code { background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.06)); padding: 0 4px; border-radius: 3px; }
    .insight-why { font-size: 0.85em; opacity: 0.85; margin: 2px 0 4px 0; }
    .insight-why code { background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.06)); padding: 0 4px; border-radius: 3px; }
    .insight-fix { margin-top: 6px; }
    .insight-fix > summary {
      cursor: pointer; font-size: 0.85em; opacity: 0.9;
      color: var(--vscode-textLink-foreground, #3794ff);
    }
    .insight-fix > summary:hover { text-decoration: underline; }
    .insight-steps { margin: 6px 0 6px 22px; padding: 0; font-size: 0.88em; line-height: 1.5; }
    .insight-steps li { margin-bottom: 4px; }
    .insight-steps code { background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.06)); padding: 0 4px; border-radius: 3px; }
    .insight-copy { margin-top: 6px; }
    .copy-block {
      background: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.25));
      color: var(--vscode-foreground, #ddd);
      border: 1px solid var(--vscode-panel-border, #444);
      padding: 8px 10px; border-radius: 4px;
      font-family: var(--vscode-editor-font-family, monospace); font-size: 0.82em;
      white-space: pre-wrap; max-height: 220px; overflow: auto; margin: 4px 0;
    }
    .copy-btn {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
      border: none; border-radius: 3px; padding: 4px 10px;
      cursor: pointer; font-size: 0.82em;
    }
    .copy-btn:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    .rule-row-detail > summary { cursor: pointer; font-size: 0.9em; }
    .rule-row-detail > summary:hover { text-decoration: underline; }
    .rule-howto { margin-top: 6px; padding: 6px 0; }
    .rule-why { font-size: 0.85em; opacity: 0.85; margin-bottom: 4px; }
    .rule-howto-steps { margin: 4px 0 4px 20px; padding: 0; font-size: 0.88em; line-height: 1.5; }
    .rule-howto-steps li { margin-bottom: 4px; }
    .rule-howto-steps code { background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.06)); padding: 0 4px; border-radius: 3px; }
    .data-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 0.9em; }
    .data-table th, .data-table td {
      text-align: left; padding: 6px 10px;
      border-bottom: 1px solid var(--vscode-panel-border, #333);
      vertical-align: top;
    }
    .data-table th { opacity: 0.75; font-size: 0.85em; font-weight: 600; }
    .data-table td.num, .data-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .badge {
      padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold;
    }
    .badge-stable { background: #28a745; color: white; }
    .badge-variable { background: #6c757d; color: white; }
    .badge-risk-none { background: #28a745; color: white; }
    .badge-risk-low { background: #5a9b4e; color: white; }
    .badge-risk-medium { background: #e36209; color: white; }
    .badge-risk-high { background: #d73a49; color: white; }
    .copy-btn {
      padding: 3px 10px;
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8em;
    }
    .copy-btn:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    code {
      font-family: var(--vscode-editor-font-family, ui-monospace, 'Cascadia Code', Menlo, monospace);
      font-size: 0.9em;
      background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.1));
      padding: 1px 5px;
      border-radius: 3px;
    }
    .muted { opacity: 0.65; font-size: 0.85em; }
    .finding-msg { margin-top: 4px; font-size: 0.85em; opacity: 0.85; }
    .empty-state {
      margin: 40px auto; max-width: 560px; text-align: center;
      background: var(--vscode-editor-inactiveSelectionBackground, #264f78);
      border-radius: 8px; padding: 24px;
    }
    .empty-inline { opacity: 0.7; font-style: italic; margin: 8px 0; }
  </style>`;
}
