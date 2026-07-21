import type { CaseMode, SearchMode } from "./preferences";

export type SearchEngineType = "bundled-ripgrep" | "system-ripgrep" | "node-fallback";

export type SearchStatus = "idle" | "searching" | "done" | "cancelled" | "error";

export interface SearchResult {
  /** Absolute path to the matched file. */
  filePath: string;
  /** Path relative to the active search directory. */
  relativePath: string;
  fileName: string;
  /** 1-based line number of the match. */
  line: number;
  /** 1-based column number of the match. */
  column: number;
  /** The matching line, truncated for display safety. */
  lineText: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

/** Fully validated, contradiction-free options handed to an engine. */
export interface SearchOptions {
  caseMode: CaseMode;
  searchMode: SearchMode;
  wholeWord: boolean;
  multiline: boolean;
  invertMatch: boolean;
  /** null means unlimited depth; 1 means the search directory only. */
  maxDepth: number | null;
  includeHidden: boolean;
  followSymlinks: boolean;
  respectIgnoreFiles: boolean;
  includeBinary: boolean;
  searchFileNames: boolean;
  includedExtensions: string[];
  excludedExtensions: string[];
  excludedDirectories: string[];
  includeGlobs: string[];
  excludeGlobs: string[];
  maxResults: number;
  maxFileSizeBytes: number;
  contextBefore: number;
  contextAfter: number;
}

export type SearchErrorKind =
  | "finder-unavailable"
  | "finder-permission-denied"
  | "directory-inaccessible"
  | "picker-cancelled"
  | "engine-unavailable"
  | "engine-startup-failed"
  | "engine-crashed"
  | "invalid-query"
  | "unexpected";

export interface SearchError {
  kind: SearchErrorKind;
  message: string;
}

/** Events documented for `rg --json`; anything else must be tolerated as unknown. */
export type RipgrepEventKind = "begin" | "match" | "context" | "end" | "summary";

export interface RipgrepEvent {
  type: RipgrepEventKind;
  data: unknown;
}

/**
 * Common engine contract. Streaming/cancellation/completion semantics are
 * specified and implemented in later tasks; the shape lives here so every
 * engine and the resolver share one type.
 */
export interface SearchEngine {
  type: SearchEngineType;
  search(request: {
    query: string;
    directory: string;
    options: SearchOptions;
    signal: AbortSignal;
    onResults: (batch: SearchResult[]) => void;
  }): Promise<{ limitReached: boolean }>;
}
