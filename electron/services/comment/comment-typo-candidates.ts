// Candidates only: dialogue, names and intentional sound effects still need contextual review.
export function findCommentTypoCandidates(text: string): string[] {
  return [...new Set(text.match(/[ㄱ-ㅎㅏ-ㅣ]{4,}/gu) ?? [])]
    .filter((candidate) => !/^[ㅋㅎㅠㅜ]+$/u.test(candidate))
    .slice(0, 5)
    .map((candidate) => candidate.slice(0, 64));
}
