import type { AccountRow } from "@/lib/supabase/types";

export interface MappingCandidate {
  account: AccountRow;
  confidence: number;
  matchReason: string;
}

export interface AccountMappingResult {
  importName: string;
  bestMatch: MappingCandidate | null;
  candidates: MappingCandidate[];
}

// Levenshtein distance
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Use a single row rolling approach for memory efficiency
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,      // insertion
        prev[j] + 1,           // deletion
        prev[j - 1] + cost     // substitution
      );
    }
    for (let j = 0; j <= n; j++) {
      prev[j] = curr[j];
    }
  }

  return prev[n];
}

export function getMatchConfidence(importName: string, accountName: string): number {
  const a = normalize(importName);
  const b = normalize(accountName);

  if (a === b) return 1.0;
  if (b.includes(a) || a.includes(b)) return 0.85;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshtein(a, b);
  const similarity = 1 - dist / maxLen;

  // Also check word-level overlap
  const aWords = new Set(a.split(/\s+/));
  const bWords = new Set(b.split(/\s+/));
  const intersection = [...aWords].filter((w) => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  const jaccardSim = union > 0 ? intersection / union : 0;

  // Weighted combination
  return similarity * 0.6 + jaccardSim * 0.4;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function autoMapAccounts(
  importNames: string[],
  accounts: AccountRow[],
  minConfidence = 0.5
): AccountMappingResult[] {
  return importNames.map((importName) => {
    const candidates: MappingCandidate[] = accounts
      .map((account) => {
        const nameConf = getMatchConfidence(importName, account.name);
        const numberConf = account.account_number
          ? getMatchConfidence(importName, account.account_number)
          : 0;

        const confidence = Math.max(nameConf, numberConf);
        const matchReason =
          numberConf > nameConf
            ? `Number match (${Math.round(numberConf * 100)}%)`
            : `Name match (${Math.round(nameConf * 100)}%)`;

        return { account, confidence, matchReason };
      })
      .filter((c) => c.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence);

    return {
      importName,
      bestMatch: candidates[0] ?? null,
      candidates: candidates.slice(0, 5),
    };
  });
}
