import type { Library } from "./model";

const combiningMarks = /\p{M}/gu;
const whitespace = /\s+/gu;

export function tagKey(value: string) {
  return value
    .normalize("NFD")
    .replace(combiningMarks, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(whitespace, " ");
}

export function normalizeTags(values: string[]) {
  const tags = new Map<string, string>();
  for (const value of values) {
    const tag = value.trim().replace(whitespace, " ").normalize("NFC");
    const key = tagKey(tag);
    if (key && !tags.has(key)) {
      tags.set(key, tag);
    }
  }
  return [...tags.values()];
}

export function suggestTags(
  options: string[],
  query: string,
  selected: string[]
) {
  const search = tagKey(query);
  const excluded = new Set(selected.map(tagKey));
  return normalizeTags(options).filter((tag) => {
    const key = tagKey(tag);
    return key.includes(search) && !excluded.has(key);
  });
}

export function libraryTags(library: Library) {
  return normalizeTags([
    ...(library.tags ?? []),
    ...library.sounds.flatMap((sound) => sound.tags),
  ]);
}

export function normalizeLibraryTags(library: Library): Library {
  const tags = libraryTags(library);
  const names = new Map(tags.map((tag) => [tagKey(tag), tag]));
  return {
    ...library,
    sounds: library.sounds.map((sound) => ({
      ...sound,
      tags: normalizeTags(sound.tags).map(
        (tag) => names.get(tagKey(tag)) ?? tag
      ),
    })),
    tags,
  };
}
