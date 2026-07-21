import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { basename } from "node:path";
import { useCallback, useState } from "react";
import { DirectoryPickerForm } from "./components/DirectoryPickerForm";
import { useContentSearch } from "./hooks/useContentSearch";
import { useSearchDirectory } from "./hooks/useSearchDirectory";
import { ENGINE_LABELS, type EngineFailure } from "./services/search-engine-resolver";
import type { SearchDirectorySource } from "./types/finder";
import type { CaseMode, SearchMode } from "./types/preferences";
import type { SearchError, SearchErrorKind, SearchOptions } from "./types/search";
import { getValidatedPreferences } from "./utils/preferences";
import { resultDetailMarkdown } from "./utils/result-detail";
import { searchOptionsFromPreferences } from "./utils/search-options";

const SOURCE_LABELS: Record<SearchDirectorySource, string> = {
  "finder-selection": "Finder selection",
  "finder-file-parent": "Parent of selected file",
  "finder-window": "Finder window",
  "default-directory": "Default directory",
  "user-picked": "Picked directory",
  home: "Home directory",
};

const ERROR_TITLES: Record<SearchErrorKind, string> = {
  "finder-unavailable": "Finder Not Available",
  "finder-permission-denied": "Finder Access Denied",
  "directory-inaccessible": "Directory Not Accessible",
  "picker-cancelled": "Directory Selection Cancelled",
  "engine-unavailable": "No Search Engine Available",
  "engine-startup-failed": "Search Engine Failed to Start",
  "engine-crashed": "Search Engine Failed",
  "invalid-query": "Invalid Query",
  "invalid-glob": "Invalid Filter Pattern",
  unexpected: "Something Went Wrong",
};

function errorIcon(kind: SearchErrorKind): Icon {
  if (kind === "finder-permission-denied" || kind === "directory-inaccessible") return Icon.Lock;
  if (kind === "invalid-query" || kind === "invalid-glob") return Icon.ExclamationMark;
  return Icon.Warning;
}

function errorDescription(error: SearchError, failures: EngineFailure[]): string {
  if (failures.length === 0) return error.message;
  const tried = failures.map((failure) => ENGINE_LABELS[failure.engine]).join(", ");
  return `${error.message}\nEngines tried first: ${tried}`;
}

interface EmptyViewProps {
  icon: Icon;
  title: string;
  description?: string;
}

function emptyViewProps(
  directory: { path: string; source: SearchDirectorySource } | null,
  finderError: SearchError | null,
  search: { status: string; query: string; error: SearchError | null; failures: EngineFailure[] },
): EmptyViewProps {
  if (directory === null) {
    if (finderError !== null) {
      return {
        icon: errorIcon(finderError.kind),
        title: ERROR_TITLES[finderError.kind] ?? "Select a Search Directory",
        description: `${finderError.message}\nPick a directory to search instead.`,
      };
    }
    return {
      icon: Icon.Folder,
      title: "Select a Search Directory",
      description: "No Finder directory was detected. Choose a directory to get started.",
    };
  }

  const location = `${directory.path} · ${SOURCE_LABELS[directory.source]}`;
  if (search.status === "error" && search.error !== null) {
    return {
      icon: errorIcon(search.error.kind),
      title: ERROR_TITLES[search.error.kind],
      description: errorDescription(search.error, search.failures),
    };
  }
  if (search.query.trim().length === 0) {
    return { icon: Icon.MagnifyingGlass, title: "Type to Search File Contents", description: location };
  }
  if (search.status === "cancelled") {
    return { icon: Icon.XMarkCircle, title: "Search Cancelled", description: location };
  }
  if (search.status === "done") {
    return {
      icon: Icon.MagnifyingGlass,
      title: "No Results",
      description: `No matches for “${search.query.trim()}” in ${basename(directory.path) || directory.path}`,
    };
  }
  return { icon: Icon.MagnifyingGlass, title: "Searching…", description: location };
}

export default function Command() {
  const [preferences] = useState(getValidatedPreferences);
  const [options, setOptions] = useState(() => searchOptionsFromPreferences(preferences));
  const [showDetail, setShowDetail] = useState(true);
  const { directory, finderError, isLoading, redetect, setDirectory, useHomeDirectory } =
    useSearchDirectory(preferences);
  const search = useContentSearch(directory?.path ?? null, options, preferences);

  const updateOptions = useCallback((patch: Partial<SearchOptions>) => {
    setOptions((previous) => {
      const keys = Object.keys(patch) as (keyof SearchOptions)[];
      // Unchanged values keep the same object identity so the running search is not restarted.
      if (keys.every((key) => previous[key] === patch[key])) return previous;
      return { ...previous, ...patch };
    });
  }, []);

  const actions = (
    <ActionPanel>
      <ActionPanel.Section title="Search Options">
        <Action
          title={options.wholeWord ? "Disable Whole Word" : "Enable Whole Word"}
          icon={Icon.Text}
          onAction={() => updateOptions({ wholeWord: !options.wholeWord })}
        />
        <Action
          title={options.includeHidden ? "Exclude Hidden Files" : "Include Hidden Files"}
          icon={options.includeHidden ? Icon.EyeDisabled : Icon.Eye}
          onAction={() => updateOptions({ includeHidden: !options.includeHidden })}
        />
        <Action
          title={options.respectIgnoreFiles ? "Search Ignored Files" : "Respect Ignore Files"}
          icon={Icon.Filter}
          onAction={() => updateOptions({ respectIgnoreFiles: !options.respectIgnoreFiles })}
        />
        <Action
          title={showDetail ? "Hide Match Preview" : "Show Match Preview"}
          icon={Icon.Document}
          onAction={() => setShowDetail((value) => !value)}
        />
      </ActionPanel.Section>
      <ActionPanel.Section title="Search Directory">
        <Action.Push
          title="Change Search Directory"
          icon={Icon.Folder}
          target={<DirectoryPickerForm onPick={(path) => void setDirectory(path, "user-picked")} />}
        />
        <Action title="Detect Finder Directory" icon={Icon.Finder} onAction={() => void redetect()} />
        <Action title="Use Home Directory" icon={Icon.House} onAction={() => void useHomeDirectory()} />
        <Action title="Refresh Search" icon={Icon.ArrowClockwise} onAction={search.refresh} />
      </ActionPanel.Section>
    </ActionPanel>
  );

  const empty = emptyViewProps(directory, finderError, search);
  const engineLabel = search.engine ? ENGINE_LABELS[search.engine] : "Resolving engine…";
  const countLabel = search.limitReached
    ? `first ${search.results.length} matches · limit reached`
    : `${search.results.length} matches`;
  const fallbackLabel =
    search.failures.length > 0
      ? `fallback from ${search.failures.map((failure) => ENGINE_LABELS[failure.engine]).join(", ")}`
      : null;
  const sectionSubtitle = directory
    ? (fallbackLabel ?? `${basename(directory.path) || directory.path} · ${SOURCE_LABELS[directory.source]}`)
    : undefined;

  return (
    <List
      filtering={false}
      isLoading={isLoading || search.status === "searching"}
      isShowingDetail={showDetail && search.results.length > 0}
      onSearchTextChange={search.setQuery}
      searchBarPlaceholder={
        directory ? `Search in ${basename(directory.path) || directory.path}…` : "Search text in files…"
      }
      searchBarAccessory={
        <List.Dropdown
          tooltip="Search Mode and Case Sensitivity"
          value={`${options.searchMode}:${options.caseMode}`}
          onChange={(value) => {
            const [searchMode, caseMode] = value.split(":") as [SearchMode, CaseMode];
            updateOptions({ searchMode, caseMode });
          }}
        >
          <List.Dropdown.Section title="Plain Text">
            <List.Dropdown.Item title="Text · Smart Case" value="text:smart" />
            <List.Dropdown.Item title="Text · Case Sensitive" value="text:sensitive" />
            <List.Dropdown.Item title="Text · Ignore Case" value="text:insensitive" />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Regular Expression">
            <List.Dropdown.Item title="Regex · Smart Case" value="regex:smart" />
            <List.Dropdown.Item title="Regex · Case Sensitive" value="regex:sensitive" />
            <List.Dropdown.Item title="Regex · Ignore Case" value="regex:insensitive" />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
      throttle
    >
      {search.results.length === 0 || directory === null ? (
        <List.EmptyView icon={empty.icon} title={empty.title} description={empty.description} actions={actions} />
      ) : (
        <List.Section title={`${engineLabel} · ${countLabel}`} subtitle={sectionSubtitle}>
          {search.results.map((result, index) => {
            const position = `${result.line}:${result.column}`;
            return (
              <List.Item
                key={`${result.filePath}:${position}:${index}`}
                icon={{ fileIcon: result.filePath }}
                title={showDetail ? result.fileName : result.lineText.trim() || result.fileName}
                subtitle={
                  showDetail ? undefined : { value: `${result.relativePath}:${position}`, tooltip: result.filePath }
                }
                accessories={showDetail ? [{ text: position }] : undefined}
                detail={
                  showDetail ? (
                    <List.Item.Detail
                      markdown={resultDetailMarkdown(result, search.query, options)}
                      metadata={
                        <List.Item.Detail.Metadata>
                          <List.Item.Detail.Metadata.Label title="File" text={result.fileName} />
                          <List.Item.Detail.Metadata.Label title="Path" text={result.relativePath} />
                          <List.Item.Detail.Metadata.Label
                            title="Position"
                            text={`line ${result.line}, column ${result.column}`}
                          />
                          <List.Item.Detail.Metadata.Separator />
                          <List.Item.Detail.Metadata.Label title="Engine" text={engineLabel} />
                          <List.Item.Detail.Metadata.Label title="Directory" text={directory.path} />
                          <List.Item.Detail.Metadata.Label title="Source" text={SOURCE_LABELS[directory.source]} />
                        </List.Item.Detail.Metadata>
                      }
                    />
                  ) : undefined
                }
                actions={actions}
              />
            );
          })}
        </List.Section>
      )}
    </List>
  );
}
