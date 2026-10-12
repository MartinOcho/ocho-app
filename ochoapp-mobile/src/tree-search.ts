/**
 * Arbre de recherche par préfixe (Prefix Tree / Trie)
 * Permet l'indexation et la recherche rapide par préfixe et calcul de pertinence
 */

export class TrieNode<T> {
  children: Map<string, TrieNode<T>> = new Map();
  isEndOfWord: boolean = false;
  items: Map<string, { item: T; score: number }> = new Map();
}

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function tokenizeText(text: string): string[] {
  const normalized = normalizeSearchText(text);
  if (!normalized) return [];
  return normalized
    .split(/[\s,.;:!?@#"'()\[\]{}<>\/\-\\_]+/)
    .filter((t) => t.length > 0);
}

export class SearchTrie<T> {
  private root: TrieNode<T> = new TrieNode<T>();

  /**
   * Insère un élément dans le Trie avec un identifiant unique et ses tokens d'indexation
   */
  insert(id: string, text: string, item: T, baseWeight: number = 1.0): void {
    const tokens = tokenizeText(text);
    if (tokens.length === 0) return;

    for (const token of tokens) {
      let node = this.root;
      for (const char of token) {
        if (!node.children.has(char)) {
          node.children.set(char, new TrieNode<T>());
        }
        node = node.children.get(char)!;
        const existing = node.items.get(id);
        const newScore = (existing?.score || 0) + baseWeight;
        node.items.set(id, { item, score: newScore });
      }
      node.isEndOfWord = true;
    }
  }

  /**
   * Recherche tous les éléments correspondant au préfixe fourni
   */
  searchPrefix(prefix: string): Map<string, { item: T; score: number }> {
    const results = new Map<string, { item: T; score: number }>();
    const tokens = tokenizeText(prefix);
    if (tokens.length === 0) return results;

    for (const token of tokens) {
      let node = this.root;
      let match = true;

      for (const char of token) {
        if (!node.children.has(char)) {
          match = false;
          break;
        }
        node = node.children.get(char)!;
      }

      if (match && node) {
        for (const [id, value] of node.items.entries()) {
          const existing = results.get(id);
          if (existing) {
            existing.score += value.score * 1.5;
          } else {
            results.set(id, { item: value.item, score: value.score });
          }
        }
      }
    }

    return results;
  }

  /**
   * Filtre et trie un ensemble d'éléments par score de recherche Trie
   */
  searchAndRank(
    query: string,
    rawItems: { id: string; text: string; data: T }[],
  ): T[] {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return rawItems.map((i) => i.data);

    this.root = new TrieNode<T>();
    for (const entry of rawItems) {
      this.insert(entry.id, entry.text, entry.data);
    }

    const matchedMap = this.searchPrefix(normalizedQuery);
    const rankedResults = Array.from(matchedMap.values())
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);

    return rankedResults;
  }
}
