// Promptimizer Panel — prompt-context analysis dashboard.
// Renders the PromptimizerResult produced by src/core/promptimizer as a
// single scrolling webview with inline (hand-rolled) SVG charts.

import * as vscode from 'vscode';
import {
  Block,
  BlockCategory,
  Finding,
  IngestedSession,
  IngestedTurn,
  PromptimizerResult,
} from '../core/promptimizer/types';
import { estimateUsdPer100Turns } from '../core/promptimizer/cost';

interface CategoryStyle {
  label: string;
  color: string;
}

const CATEGORY_STYLES: Record<BlockCategory, CategoryStyle> = {
  system: { label: 'System', color: '#3794ff' },
  custom_instruction: { label: 'Custom Instruction', color: '#4ec9b0' },
  skill: { label: 'Skill', color: '#c586c0' },
  agent: { label: 'Agent', color: '#ce9178' },
  sub_agent: { label: 'Sub-agent', color: '#dcdcaa' },
  mcp_tool: { label: 'MCP Tool', color: '#f14c4c' },
  built_in_tool: { label: 'Built-in Tool', color: '#b5cea8' },
  user_message: { label: 'User Message', color: '#569cd6' },
  assistant_message: { label: 'Assistant Message', color: '#9cdcfe' },
  tool_result: { label: 'Tool Result', color: '#d7ba7d' },
  attachment: { label: 'Attachment', color: '#a0a0a0' },
  cache_control_overhead: { label: 'Cache-Control Overhead', color: '#d16969' },
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
interface TreemapItem { key: string; label: string; value: number; color: string; }
interface LaidItem extends Rect { item: TreemapItem; }

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
    const sessionIds = result.sessions.map((s) => s.session_id);
    if (!this.currentSessionId || !sessionIds.includes(this.currentSessionId)) {
      this.currentSessionId = sessionIds[0];
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
    const stackedBar = this.renderStackedBar(session);
    const treemap = this.renderTreemap(session);
    const toolList = this.renderMcpToolList(session);
    const heatmap = this.renderHeatmap(session);
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

  <h2>Tokens by Turn (stacked by category)</h2>
  ${stackedBar}

  <h2>Category Treemap</h2>
  ${treemap}

  <h2>MCP Tools — Ranked by Tokens</h2>
  ${toolList}

  <h2>Diff Heatmap (block stability across turns)</h2>
  ${heatmap}

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
      }
    });
  </script>
</body>
</html>`;
  }

  private renderSessionSelector(sessions: IngestedSession[]): string {
    if (sessions.length <= 1) {
      const s = sessions[0];
      const label = s.label ?? s.session_id;
      return `<span class="session-label">Session: <code>${escapeHtml(label)}</code> · ${s.turns.length} turns</span>`;
    }
    const options = sessions
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
    const avgPerTurn = stats.totalTokens / turns;

    let currentCost100 = 0;
    let afterCost100 = 0;
    try {
      currentCost100 = estimateUsdPer100Turns(avgPerTurn, result.model, 'fresh', 100);
    } catch {
      currentCost100 = 0;
    }
    const topCachingSavings = result.findings
      .filter((f) => f.category === 'caching')
      .slice(0, 3)
      .reduce((s, f) => s + (f.estimated_savings?.usd_per_100_turns ?? 0), 0);
    afterCost100 = Math.max(0, currentCost100 - topCachingSavings);

    const stablePct = stats.totalTokens > 0
      ? Math.round((stats.stableTokens / stats.totalTokens) * 100)
      : 0;
    const variablePct = 100 - stablePct;

    return `<div class="scorecard">
      <div class="score-card">
        <div class="value">${formatNumber(stats.totalTokens)}</div>
        <div class="label">Total tokens · ${turns} turn(s) · ${escapeHtml(model)}</div>
      </div>
      <div class="score-card">
        <div class="value">${stablePct}% / ${variablePct}%</div>
        <div class="label">Stable vs variable tokens</div>
      </div>
      <div class="score-card">
        <div class="value">$${currentCost100.toFixed(2)}</div>
        <div class="label">Current est. $ / 100 turns</div>
      </div>
      <div class="score-card">
        <div class="value">$${afterCost100.toFixed(2)}</div>
        <div class="label">After top caching recs</div>
      </div>
      <div class="score-card">
        <div class="value">${result.findings.length}</div>
        <div class="label">Findings</div>
      </div>
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
        const titleText = `Turn ${turn.turn} · ${style.label}: ${formatNumber(tokens)} tokens`;
        bars.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" fill="${style.color}"><title>${escapeHtml(titleText)}</title></rect>`);
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
      return `<span class="legend-item"><span class="legend-swatch" style="background:${s.color}"></span>${escapeHtml(s.label)}</span>`;
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
      items.push({ key: cat, label: CATEGORY_STYLES[cat].label, value: v, color: CATEGORY_STYLES[cat].color });
    }

    const width = 760;
    const height = 360;
    const selector = `<label class="inline-label">View: <select data-treemap-select>${options.join('')}</select></label>`;
    if (items.length === 0 || totalTokens === 0) {
      return `<div class="chart-wrap">${selector}<p class="empty-inline">No tokens to display for this selection.</p></div>`;
    }
    const laid = squarify(items, { x: 0, y: 0, w: width, h: height });
    const rects = laid.map((r) => {
      const pct = (r.item.value / totalTokens) * 100;
      const title = `${r.item.label}: ${formatNumber(r.item.value)} tokens (${pct.toFixed(1)}%)`;
      const labelText = `${r.item.label} · ${formatNumber(r.item.value)}`;
      const showText = r.w > 70 && r.h > 22;
      const text = showText
        ? `<text x="${r.x + 6}" y="${r.y + 16}" class="tm-label">${escapeHtml(labelText)}</text>`
        : '';
      return `<g><rect x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}" fill="${r.item.color}" class="tm-rect"><title>${escapeHtml(title)}</title></rect>${text}</g>`;
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

  private renderHeatmap(session: IngestedSession): string {
    const turns = session.turns;
    if (turns.length === 0) {
      return '<p class="empty-inline">No turns in this session.</p>';
    }
    const blockMeta = collectBlockIds(turns);
    if (blockMeta.length === 0) {
      return '<p class="empty-inline">No blocks in this session.</p>';
    }
    const cellW = 22;
    const cellH = 14;
    const labelW = 260;
    const headerH = 26;
    const padR = 12;
    const width = labelW + turns.length * cellW + padR;
    const height = headerH + blockMeta.length * cellH + 12;

    const header: string[] = [];
    turns.forEach((turn, i) => {
      const x = labelW + i * cellW + cellW / 2;
      header.push(`<text x="${x}" y="${headerH - 6}" class="axis-label" text-anchor="middle">${turn.turn}</text>`);
    });

    const rows: string[] = [];
    blockMeta.forEach((meta, r) => {
      const y = headerH + r * cellH;
      const label = truncate(`${categoryShort(meta.category)} · ${meta.displayName}`, 38);
      const fullTitle = `${meta.id} (${meta.category})`;
      rows.push(`<text x="${labelW - 8}" y="${y + cellH - 3}" class="axis-label hm-label" text-anchor="end"><title>${escapeHtml(fullTitle)}</title>${escapeHtml(label)}</text>`);
      turns.forEach((turn, i) => {
        const b = turn.blocks.find((bl) => bl.id === meta.id);
        const x = labelW + i * cellW;
        let fill = 'transparent';
        let title = `Turn ${turn.turn} · ${meta.id}: absent`;
        if (b) {
          if (b.stable === true) {
            fill = 'var(--hm-stable, rgba(120,120,120,0.35))';
            title = `Turn ${turn.turn} · ${meta.id}: stable · ${formatNumber(b.tokens ?? 0)} tokens`;
          } else {
            fill = 'var(--hm-changed, #f14c4c)';
            title = `Turn ${turn.turn} · ${meta.id}: changed · ${formatNumber(b.tokens ?? 0)} tokens`;
          }
        }
        rows.push(`<rect x="${x + 1}" y="${y + 1}" width="${cellW - 2}" height="${cellH - 2}" fill="${fill}" class="hm-cell"><title>${escapeHtml(title)}</title></rect>`);
      });
    });

    return `<div class="chart-wrap heatmap-wrap">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Diff heatmap of block stability per turn">
        ${header.join('')}
        ${rows.join('')}
      </svg>
      <div class="legend">
        <span class="legend-item"><span class="legend-swatch" style="background:rgba(120,120,120,0.35)"></span>stable</span>
        <span class="legend-item"><span class="legend-swatch" style="background:#f14c4c"></span>changed</span>
        <span class="legend-item"><span class="legend-swatch" style="background:transparent;border:1px dashed var(--vscode-panel-border,#444)"></span>absent</span>
      </div>
    </div>`;
  }

  private renderFindings(findings: Finding[]): string {
    if (findings.length === 0) {
      return '<p class="empty-inline">No findings. Nothing to optimize — nice work!</p>';
    }
    const rows = findings.map((f, idx) => {
      const blocks = f.evidence?.blocks ?? [];
      const tokens = f.evidence?.tokens ?? 0;
      const evidenceBlocks = blocks.slice(0, 6).map((b) => `<code>${escapeHtml(b)}</code>`).join(' ');
      const moreBlocks = blocks.length > 6 ? ` <span class="muted">+${blocks.length - 6} more</span>` : '';
      const savings = f.estimated_savings?.usd_per_100_turns ?? 0;
      const msg = f.message ? `<div class="finding-msg">${escapeHtml(f.message)}</div>` : '';
      return `<tr>
        <td><code>${escapeHtml(f.rule)}</code>${msg}</td>
        <td>${escapeHtml(f.category)}</td>
        <td><span class="badge badge-risk-${f.quality_risk}">${escapeHtml(f.quality_risk)}</span></td>
        <td class="num">$${savings.toFixed(2)}</td>
        <td>${evidenceBlocks}${moreBlocks}<div class="muted">${formatNumber(tokens)} tokens</div></td>
        <td>${f.patch ? `<button class="copy-btn" data-copy-patch="${idx}">Copy patch</button>` : '<span class="muted">no patch</span>'}</td>
      </tr>`;
    }).join('');
    return `<table class="data-table findings-table">
      <thead><tr><th>Rule</th><th>Category</th><th>Quality risk</th><th class="num">$ / 100 turns</th><th>Evidence</th><th></th></tr></thead>
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

interface BlockMeta {
  id: string;
  category: BlockCategory;
  displayName: string;
  firstTokens: number;
}

function collectBlockIds(turns: IngestedTurn[]): BlockMeta[] {
  const seen = new Map<string, BlockMeta>();
  const order: string[] = [];
  for (const turn of turns) {
    for (const b of turn.blocks) {
      if (!seen.has(b.id)) {
        const displayName = b.name ?? (b.server ? `${b.server}/${b.name ?? ''}` : b.id);
        seen.set(b.id, {
          id: b.id,
          category: b.category,
          displayName,
          firstTokens: b.tokens ?? 0,
        });
        order.push(b.id);
      }
    }
  }
  // Group by category for nicer visual clustering.
  return order
    .map((id) => seen.get(id) as BlockMeta)
    .sort((a, b) => {
      const ca = CATEGORY_ORDER.indexOf(a.category);
      const cb = CATEGORY_ORDER.indexOf(b.category);
      if (ca !== cb) { return ca - cb; }
      return b.firstTokens - a.firstTokens;
    });
}

function categoryShort(cat: BlockCategory): string {
  return CATEGORY_STYLES[cat].label;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
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
    .tm-rect { stroke: var(--vscode-editor-background, #1e1e1e); stroke-width: 1; }
    .tm-label { fill: #111; font-size: 11px; font-weight: 600; pointer-events: none; }
    .hm-cell { stroke: var(--vscode-panel-border, #2a2a2a); stroke-width: 0.5; }
    .hm-label { font-size: 10px; }
    .heatmap-wrap { --hm-stable: rgba(120,120,120,0.35); --hm-changed: #f14c4c; }
    .legend {
      display: flex; flex-wrap: wrap; gap: 10px 14px; margin: 10px 0 4px 0; font-size: 0.8em;
    }
    .legend-item { display: inline-flex; align-items: center; gap: 5px; }
    .legend-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; }
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
