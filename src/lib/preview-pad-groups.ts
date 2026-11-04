export interface PreviewPadGroup {
  id: string;
  name: string;
  padIds: string[];
}

const storageKey = "soundbard-preview-pad-groups";

function readGroup(
  value: unknown,
  allowedIds: ReadonlySet<string>
): PreviewPadGroup | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value && "name" in value && "padIds" in value)
  ) {
    return null;
  }
  const { id, name, padIds } = value;
  if (
    typeof id !== "string" ||
    !id.trim() ||
    typeof name !== "string" ||
    !name.trim() ||
    !Array.isArray(padIds) ||
    !padIds.every(
      (padId: unknown): padId is string => typeof padId === "string"
    )
  ) {
    return null;
  }
  const knownIds = [
    ...new Set(padIds.filter((padId) => allowedIds.has(padId))),
  ];
  if (knownIds.length === 0) {
    return null;
  }
  return { id: id.trim(), name: name.trim(), padIds: knownIds };
}

export function loadPreviewPadGroups(
  storage: Pick<Storage, "getItem">,
  allowedIds: readonly string[],
  key = storageKey
): PreviewPadGroup[] {
  try {
    const stored = storage.getItem(key);
    if (stored === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const allowed = new Set(allowedIds);
    const seen = new Set<string>();
    const groups: PreviewPadGroup[] = [];
    for (const entry of parsed) {
      const group = readGroup(entry, allowed);
      if (group && !seen.has(group.id)) {
        seen.add(group.id);
        groups.push(group);
      }
    }
    return groups;
  } catch {
    return [];
  }
}

export function savePreviewPadGroups(
  storage: Pick<Storage, "setItem">,
  groups: readonly PreviewPadGroup[],
  key = storageKey
): boolean {
  try {
    storage.setItem(key, JSON.stringify(groups));
    return true;
  } catch {
    return false;
  }
}
