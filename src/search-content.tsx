import { List } from "@raycast/api";
import { useState } from "react";
import { getValidatedPreferences } from "./utils/preferences";

const ENGINE_LABELS: Record<string, string> = {
  automatic: "Automatic",
  bundled: "Bundled ripgrep",
  system: "System ripgrep",
  node: "Node.js fallback",
};

export default function Command() {
  const [preferences] = useState(getValidatedPreferences);
  const [searchText, setSearchText] = useState("");

  return (
    <List filtering={false} onSearchTextChange={setSearchText} searchBarPlaceholder="Search text in files…" throttle>
      <List.EmptyView
        title={searchText ? "Search Not Wired Up Yet" : "Type to Search File Contents"}
        description={`Engine preference: ${ENGINE_LABELS[preferences.preferredEngine]}`}
      />
    </List>
  );
}
