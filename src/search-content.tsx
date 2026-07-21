import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { basename } from "node:path";
import { useState } from "react";
import { DirectoryPickerForm } from "./components/DirectoryPickerForm";
import { useContentSearch } from "./hooks/useContentSearch";
import { useSearchDirectory } from "./hooks/useSearchDirectory";
import { ENGINE_LABELS } from "./services/search-engine-resolver";
import type { SearchDirectorySource } from "./types/finder";
import type { SearchStatus } from "./types/search";
import { getValidatedPreferences } from "./utils/preferences";
import { searchOptionsFromPreferences } from "./utils/search-options";

const SOURCE_LABELS: Record<SearchDirectorySource, string> = {
  "finder-selection": "Finder selection",
  "finder-file-parent": "Parent of selected file",
  "finder-window": "Finder window",
  "default-directory": "Default directory",
  "user-picked": "Picked directory",
  home: "Home directory",
};

function emptyTitle(status: SearchStatus, query: string): string {
  if (status === "error") return "Search Failed";
  if (status === "searching") return "Searching…";
  if (query.trim().length === 0) return "Type to Search File Contents";
  return status === "cancelled" ? "Search Cancelled" : "No Results";
}

export default function Command() {
  const [preferences] = useState(getValidatedPreferences);
  const [options] = useState(() => searchOptionsFromPreferences(preferences));
  const { directory, finderError, isLoading, redetect, setDirectory, useHomeDirectory } =
    useSearchDirectory(preferences);
  const search = useContentSearch(directory?.path ?? null, options, preferences);

  const directoryActions = (
    <ActionPanel>
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

  const emptyView = directory ? (
    <List.EmptyView
      icon={search.status === "error" ? Icon.Warning : Icon.MagnifyingGlass}
      title={emptyTitle(search.status, search.query)}
      description={search.error?.message ?? `${directory.path} · ${SOURCE_LABELS[directory.source]}`}
      actions={directoryActions}
    />
  ) : (
    <List.EmptyView
      icon={Icon.Folder}
      title="Select a Search Directory"
      description={finderError?.message ?? "No Finder directory was detected."}
      actions={directoryActions}
    />
  );

  const sectionTitle = [
    search.engine ? ENGINE_LABELS[search.engine] : "Searching…",
    search.limitReached ? `first ${search.results.length} results` : `${search.results.length} results`,
  ].join(" · ");

  return (
    <List
      filtering={false}
      isLoading={isLoading || search.status === "searching"}
      onSearchTextChange={search.setQuery}
      searchBarPlaceholder={
        directory ? `Search in ${basename(directory.path) || directory.path}…` : "Search text in files…"
      }
      throttle
    >
      {search.results.length === 0 ? (
        emptyView
      ) : (
        <List.Section title={sectionTitle}>
          {search.results.map((result, index) => (
            <List.Item
              key={`${result.filePath}:${result.line}:${result.column}:${index}`}
              icon={Icon.Text}
              title={result.lineText.trim() || result.fileName}
              subtitle={`${result.relativePath}:${result.line}:${result.column}`}
              actions={directoryActions}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}
