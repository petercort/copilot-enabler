// Promptimizer TreeView — sessions -> turns -> findings, plus a top
// "Top Findings" aggregation. See docs/copilot-research-*.md §8 for the
// Finding schema powering each leaf.

import * as vscode from 'vscode';
import {
  Finding,
  IngestedSession,
  IngestedTurn,
  PromptimizerResult,
  QualityRisk,
} from '../core/promptimizer/types';

const RISK_WEIGHT: Record<QualityRisk, number> = {
  none: 1,
  low: 2,
  medium: 4,
  high: 8,
};

const RISK_ICON: Record<QualityRisk, string> = {
  high: 'flame',
  medium: 'warning',
  low: 'info',
  none: 'check',
};

function scoreOf(f: Finding): number {
  const w = RISK_WEIGHT[f.quality_risk] ?? 1;
  return (f.estimated_savings?.usd_per_100_turns ?? 0) / w;
}

function totalTurnTokens(turn: IngestedTurn): number {
  let sum = 0;
  for (const b of turn.blocks) {
    sum += b.tokens ?? 0;
  }
  return sum;
}

function totalSessionTokens(session: IngestedSession): number {
  let sum = 0;
  for (const t of session.turns) {
    sum += totalTurnTokens(t);
  }
  return sum;
}

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function findingsForTurn(findings: Finding[], turn: IngestedTurn): Finding[] {
  const ids = new Set(turn.blocks.map((b) => b.id));
  return findings.filter((f) => (f.evidence?.blocks ?? []).some((b) => ids.has(b)));
}

export class SessionNode extends vscode.TreeItem {
  readonly kind = 'session' as const;
  constructor(
    public readonly session: IngestedSession,
    public readonly findings: Finding[],
  ) {
    const totalTokens = totalSessionTokens(session);
    super(
      session.label ?? `Session: ${session.session_id}`,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.description = `${session.turns.length} turns · ${totalTokens} tokens`;
    this.iconPath = new vscode.ThemeIcon('comment-discussion');
    this.contextValue = 'promptimizerSession';
    const lines = [
      `**${session.label ?? session.session_id}**`,
      `Session id: \`${session.session_id}\``,
      `Model: ${session.model ?? 'unknown'}`,
      `Turns: ${session.turns.length}`,
      `Tokens: ${totalTokens}`,
    ];
    if (session.context?.['repository']) { lines.push(`Repository: ${session.context['repository']}`); }
    if (session.context?.['branch']) { lines.push(`Branch: ${session.context['branch']}`); }
    if (session.context?.['cwd']) { lines.push(`Cwd: \`${session.context['cwd']}\``); }
    if (session.firstPrompt) { lines.push(`\n> ${session.firstPrompt}`); }
    this.tooltip = new vscode.MarkdownString(lines.join('\n\n'));
  }
}

export class TurnNode extends vscode.TreeItem {
  readonly kind = 'turn' as const;
  constructor(
    public readonly session: IngestedSession,
    public readonly turn: IngestedTurn,
    public readonly findings: Finding[],
  ) {
    const tokens = totalTurnTokens(turn);
    const state = findings.length > 0
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
    super(`Turn ${turn.turn}`, state);
    this.description = `${tokens} tokens`;
    this.iconPath = new vscode.ThemeIcon('arrow-right');
    this.contextValue = 'promptimizerTurn';
    this.tooltip = new vscode.MarkdownString(
      `**Turn ${turn.turn}**\n\n` +
        `${session.label ?? session.session_id}\n\n` +
        `Blocks: ${turn.blocks.length}\n\n` +
        `Tokens: ${tokens}\n\n` +
        `Findings: ${findings.length}`,
    );
  }
}

export class FindingNode extends vscode.TreeItem {
  readonly kind = 'finding' as const;
  constructor(public readonly finding: Finding) {
    const usd = finding.estimated_savings?.usd_per_100_turns ?? 0;
    const summary = finding.message ?? finding.rule;
    super(
      `${finding.rule} · ${summary} · ${formatUsd(usd)}/100 turns`,
      vscode.TreeItemCollapsibleState.None,
    );
    this.description = finding.quality_risk;
    this.iconPath = new vscode.ThemeIcon(RISK_ICON[finding.quality_risk] ?? 'info');
    this.contextValue = 'promptimizerFinding';

    const blocks = finding.evidence?.blocks ?? [];
    const tokens = finding.evidence?.tokens;
    const stableTurns = finding.evidence?.stable_turns;
    const parts: string[] = [
      `**${finding.rule}** (${finding.category})`,
      '',
      summary,
      '',
      `Estimated savings: ${formatUsd(usd)} / 100 turns`,
      `Tokens per turn: ${finding.estimated_savings?.tokens_per_turn ?? 0}`,
      `Input-token share after: ${finding.estimated_savings?.input_token_share_after ?? 0}`,
      `Quality risk: ${finding.quality_risk}`,
    ];
    if (typeof tokens === 'number') {
      parts.push(`Evidence tokens: ${tokens}`);
    }
    if (typeof stableTurns === 'number') {
      parts.push(`Stable turns: ${stableTurns}`);
    }
    if (blocks.length > 0) {
      parts.push('', `Blocks: ${blocks.join(', ')}`);
    }
    this.tooltip = new vscode.MarkdownString(parts.join('\n'));

    this.command = {
      command: 'copilotEnabler.promptimizer.openFinding',
      title: 'Open Finding',
      arguments: [finding],
    };
  }
}

export class AggregatedFindingsNode extends vscode.TreeItem {
  readonly kind = 'aggregated' as const;
  constructor(public readonly findings: Finding[]) {
    const state = findings.length > 0
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    super('Top Findings', state);
    this.description = `${findings.length}`;
    this.iconPath = new vscode.ThemeIcon('list-ordered');
    this.contextValue = 'promptimizerAggregated';
  }
}

class EmptyStateNode extends vscode.TreeItem {
  readonly kind = 'empty' as const;
  constructor() {
    super(
      "No prompt logs ingested — run 'Copilot Enabler: Ingest Prompt Log'",
      vscode.TreeItemCollapsibleState.None,
    );
    this.iconPath = new vscode.ThemeIcon('info');
    this.contextValue = 'promptimizerEmpty';
  }
}

export type PromptimizerTreeNode =
  | SessionNode
  | TurnNode
  | FindingNode
  | AggregatedFindingsNode
  | EmptyStateNode;

export class PromptimizerTreeProvider
  implements vscode.TreeDataProvider<PromptimizerTreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    PromptimizerTreeNode | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private result: PromptimizerResult | undefined;

  refresh(result: PromptimizerResult | undefined): void {
    this.result = result;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: PromptimizerTreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: PromptimizerTreeNode): PromptimizerTreeNode[] {
    if (!element) {
      if (!this.result || this.result.sessions.length === 0) {
        return [new EmptyStateNode()];
      }
      const sortedSessions = [...this.result.sessions].sort((a, b) => {
        const ta = a.startedAt ?? '';
        const tb = b.startedAt ?? '';
        return tb.localeCompare(ta);
      });
      const sessionNodes: PromptimizerTreeNode[] = sortedSessions.map(
        (s) => new SessionNode(s, this.result!.findings),
      );
      const top = [...this.result.findings]
        .sort((a, b) => scoreOf(b) - scoreOf(a))
        .slice(0, 10);
      sessionNodes.push(new AggregatedFindingsNode(top));
      return sessionNodes;
    }

    if (element instanceof SessionNode) {
      return element.session.turns.map(
        (t) =>
          new TurnNode(
            element.session,
            t,
            findingsForTurn(element.findings, t),
          ),
      );
    }

    if (element instanceof TurnNode) {
      return element.findings.map((f) => new FindingNode(f));
    }

    if (element instanceof AggregatedFindingsNode) {
      return element.findings.map((f) => new FindingNode(f));
    }

    return [];
  }
}
