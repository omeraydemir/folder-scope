import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { basename } from "node:path";
import { useState } from "react";
import { DirectoryPickerForm } from "./components/DirectoryPickerForm";
import { useSearchDirectory } from "./hooks/useSearchDirectory";
import type { SearchDirectorySource } from "./types/finder";
import { getValidatedPreferences } from "./utils/preferences";

const SOURCE_LABELS: Record<SearchDirectorySource, string> = {
  "finder-selection": "Finder selection",
  "finder-file-parent": "Parent of selected file",
  "finder-window": "Finder window",
  "default-directory": "Default directory",
  "user-picked": "Picked directory",
  home: "Home directory",
};

export default function Command() {
  const [preferences] = useState(getValidatedPreferences);
  const { directory, finderError, isLoading, redetect, setDirectory, useHomeDirectory } =
    useSearchDirectory(preferences);
  const [searchText, setSearchText] = useState("");

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
      </ActionPanel.Section>
    </ActionPanel>
  );

  const emptyView = directory ? (
    <List.EmptyView
      icon={Icon.MagnifyingGlass}
      title={searchText ? "Search Not Wired Up Yet" : "Type to Search File Contents"}
      description={`${directory.path} · ${SOURCE_LABELS[directory.source]}`}
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

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={
        directory ? `Search in ${basename(directory.path) || directory.path}…` : "Search text in files…"
      }
      throttle
    >
      {emptyView}
    </List>
  );
}
