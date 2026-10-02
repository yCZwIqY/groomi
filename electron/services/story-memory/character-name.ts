export function normalizeCharacterName(name: string) {
  return name.normalize('NFKC').replace(/\s+/g, '');
}

export function findCharacterByName<T extends { name: string }>(items: T[], name: string) {
  const normalized = normalizeCharacterName(name);
  const exact = items.find((item) => normalizeCharacterName(item.name) === normalized);
  if (exact) return exact;
  const base = (value: string) => normalizeCharacterName(value).replace(/\([^()]*\)/g, '');
  const candidates = items.filter((item) => base(item.name) === base(name));
  // Parenthetical aliases are a fallback only when they identify one registered character.
  return candidates.length === 1 ? candidates[0] : undefined;
}
