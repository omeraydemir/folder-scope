import type { CaseMode } from "../types/preferences.ts";
import type { SearchOptions, SearchResult } from "../types/search.ts";

/** The subset of options that affects how a match is located for highlighting. */
export type HighlightOptions = Pick<SearchOptions, "searchMode" | "caseMode">;

function isCaseSensitive(query: string, caseMode: CaseMode): boolean {
  if (caseMode === "sensitive") return true;
  if (caseMode === "insensitive") return false;
  return query !== query.toLocaleLowerCase(); // smart case
}

/**
 * Best-effort location of the match inside `lineText` as a [start, end) span,
 * or null when it cannot be located reliably (invalid JS regex, truncated
 * preview, byte/char column drift). Highlighting is cosmetic — a miss must
 * degrade to "no bold", never to a wrong-looking result.
 */
export function locateMatch(
  lineText: string,
  column: number,
  query: string,
  options: HighlightOptions,
): [number, number] | null {
  if (query.length === 0 || lineText.length === 0) return null;
  const start = Math.max(0, column - 1);

  if (options.searchMode === "regex") {
    let re: RegExp;
    try {
      // ponytail: JS regex ≈ ripgrep's Rust regex for common patterns; on
      // syntax divergence we simply skip highlighting.
      re = new RegExp(query, isCaseSensitive(query, options.caseMode) ? "g" : "gi");
    } catch {
      return null;
    }
    let first: [number, number] | null = null;
    for (let match = re.exec(lineText); match !== null; match = re.exec(lineText)) {
      if (match[0].length === 0) break;
      const span: [number, number] = [match.index, match.index + match[0].length];
      first ??= span;
      if (span[1] > start) return span;
    }
    return first;
  }

  const sensitive = isCaseSensitive(query, options.caseMode);
  const haystack = sensitive ? lineText : lineText.toLocaleLowerCase();
  const needle = sensitive ? query : query.toLocaleLowerCase();
  if (haystack.startsWith(needle, start)) return [start, start + needle.length];
  const index = haystack.indexOf(needle);
  return index === -1 ? null : [index, index + needle.length];
}

const MARKDOWN_SPECIALS = /[\\`*_{}[\]()#+\-.!<>|~]/g;

function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_SPECIALS, "\\$&");
}

/** Length-preserving, so match spans computed on the raw line stay valid. */
function protectIndent(line: string): string {
  return line.replace(/^[ \t]+/, (match) => "\u00A0".repeat(match.length));
}

function renderLine(rawLine: string, span: [number, number] | null): string {
  const line = protectIndent(rawLine);
  if (span === null || span[0] >= span[1] || span[1] > line.length) return escapeMarkdown(line);
  const before = escapeMarkdown(line.slice(0, span[0]));
  const match = escapeMarkdown(line.slice(span[0], span[1]));
  const after = escapeMarkdown(line.slice(span[1]));
  return `${before}**${match}**${after}`;
}

/**
 * Detail-pane markdown: context-before lines, the match line with the matched
 * range bolded, context-after lines — joined with hard line breaks.
 */
export function resultDetailMarkdown(result: SearchResult, query: string, options: HighlightOptions): string {
  const span = locateMatch(result.lineText, result.column, query.trim(), options);
  const lines = [
    ...(result.contextBefore ?? []).map((line) => renderLine(line, null)),
    renderLine(result.lineText, span),
    ...(result.contextAfter ?? []).map((line) => renderLine(line, null)),
  ];
  return lines.map((line) => (line.length === 0 ? "\u00A0" : line)).join("  \n");
}
