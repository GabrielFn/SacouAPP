const WORD_WITH_SPACES = /\s*\S+\s*/g;

/**
 * The plain parts of the terms sentence, one piece per word with its spaces, so the line wraps word by
 * word like the text of the canvas instead of moving a whole part to the next line.
 */
export function wordsOf(text: string): readonly string[] {
  const words = text.match(WORD_WITH_SPACES);
  if (words !== null) return words;
  return text === "" ? [] : [text];
}
