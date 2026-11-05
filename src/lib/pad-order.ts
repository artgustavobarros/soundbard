export function orderPads<T extends { id: string }>(
  pads: T[],
  order: readonly string[]
): T[] {
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...pads].sort(
    (left, right) =>
      (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  );
}

export function reorderVisiblePads(
  pads: { id: string }[],
  visible: readonly string[],
  changed: readonly string[]
): string[] {
  const visibleIds = new Set(visible);
  const allIds = new Set(pads.map((pad) => pad.id));
  if (
    visibleIds.size !== visible.length ||
    changed.length !== visible.length ||
    new Set(changed).size !== visible.length ||
    changed.some((id) => !visibleIds.has(id)) ||
    visible.some((id) => !allIds.has(id))
  ) {
    throw new Error(
      "A ordem dos pads mudou. Recarregue a mesa antes de reorganizar."
    );
  }
  let position = 0;
  return pads.map((pad) => {
    if (!visibleIds.has(pad.id)) {
      return pad.id;
    }
    const id = changed[position];
    position += 1;
    return id;
  });
}
