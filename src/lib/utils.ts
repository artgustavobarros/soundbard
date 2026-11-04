export function inOrder<T>(
  items: readonly T[],
  action: (item: T, index: number) => Promise<void>
): Promise<void> {
  return items.reduce(
    (pending, item, index) => pending.then(() => action(item, index)),
    Promise.resolve()
  );
}
export const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export const bytes = (size: number) =>
  size >= 1024 ** 3
    ? `${(size / 1024 ** 3).toFixed(1)} GB`
    : `${(size / 1024 ** 2).toFixed(1)} MB`;
export const tagsFrom = (value: FormDataEntryValue | null) => [
  ...new Set(
    String(value ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  ),
];
