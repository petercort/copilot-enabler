// Shared static-analysis types used by the main dashboard and recommendation flow.

/** Quality-risk label for static heuristics. */
export type QualityRisk = 'none' | 'low' | 'medium' | 'high';

/** Evidence gathered by a static-scan rule for reviewer confidence. */
export interface StaticFindingEvidence {
  count?: number;
  lines?: number[];
  excerpts?: string[];
  fenceCount?: number;
  tokens?: number;
  /** Total line count of the scanned file (S-AOC1). */
  lines_count?: number;
  /** Whether the instruction file has an `applyTo` scope pattern (S-ASC1). */
  hasApplyTo?: boolean;
  /** Number of volatile prefix patterns found near the top of the file (S-PCS1). */
  volatileCount?: number;
  fileB?: string;
  similarity?: number;
  sharedParagraphs?: number;
  [key: string]: unknown;
}

/** Finding emitted by the static file scanner (no session context needed). */
export interface StaticFinding {
  rule: string;
  category: 'authoring' | 'hygiene' | 'compression';
  /** Absolute path of the scanned file. */
  file: string;
  /** 1-based line number of the first offending line, if applicable. */
  line?: number;
  evidence: StaticFindingEvidence;
  quality_risk: QualityRisk;
  /** Human-readable summary for UI display. */
  message: string;
}


