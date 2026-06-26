export const MAX_WRONG = 5;

export const KEYBOARD_ROWS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

export const MAX_LETTER_BOXES_PER_ROW = 8;

export type AnswerCell =
  | { kind: 'letter'; ch: string; key: string }
  | { kind: 'space'; key: string };

export const normalizeAnswer = (phrase: string) =>
  phrase
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const chunkWordToMaxLetters = (word: string): string[] => {
  if (word.length <= MAX_LETTER_BOXES_PER_ROW) {
    return [word];
  }
  const parts: string[] = [];
  for (let i = 0; i < word.length; i += MAX_LETTER_BOXES_PER_ROW) {
    parts.push(word.slice(i, i + MAX_LETTER_BOXES_PER_ROW));
  }
  return parts;
};

export const buildAnswerRows = (answer: string): AnswerCell[][] => {
  const words = answer.split(' ').filter((w) => w.length > 0);
  const rows: AnswerCell[][] = [];
  let row: AnswerCell[] = [];
  let lettersInRow = 0;
  let spaceKey = 0;

  const flush = () => {
    while (row.length > 0 && row[row.length - 1].kind === 'space') {
      row.pop();
    }
    if (row.length > 0) {
      rows.push(row);
      row = [];
      lettersInRow = 0;
    }
  };

  const wordStartIndex = (wordIndex: number) => {
    let offset = 0;
    for (let j = 0; j < wordIndex; j++) {
      offset += words[j]!.length + 1;
    }
    return offset;
  };

  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi]!;
    const base = wordStartIndex(wi);
    const chunks = chunkWordToMaxLetters(word);

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci]!;
      const chunkCharBase = base + ci * MAX_LETTER_BOXES_PER_ROW;

      if (wi > 0 && ci === 0) {
        if (lettersInRow > 0) {
          if (lettersInRow + chunk.length > MAX_LETTER_BOXES_PER_ROW) {
            flush();
          }
          if (lettersInRow > 0) {
            row.push({ kind: 'space', key: `space-bw-${spaceKey++}` });
          }
        }
      }

      if (lettersInRow + chunk.length > MAX_LETTER_BOXES_PER_ROW) {
        flush();
      }

      for (let k = 0; k < chunk.length; k++) {
        const ch = chunk[k]!;
        row.push({
          kind: 'letter',
          ch,
          key: `letter-${chunkCharBase + k}-${ch}`,
        });
        lettersInRow += 1;
      }
    }
  }

  flush();
  return rows;
};

export const computeWordLayout = (windowWidth: number) => {
  const gap = 8;
  const horizontalPadding = 16;
  const available = Math.max(220, windowWidth - horizontalPadding);
  const spaceWidth = Math.min(28, Math.max(14, Math.round(windowWidth * 0.036)));
  const maxLetterGaps = MAX_LETTER_BOXES_PER_ROW - 1;
  const maxSpacesPerRow = MAX_LETTER_BOXES_PER_ROW - 1;
  const reserved = maxLetterGaps * gap + maxSpacesPerRow * spaceWidth;
  const rawSlotW = (available - reserved) / MAX_LETTER_BOXES_PER_ROW;
  const slotW = Math.min(72, Math.max(42, rawSlotW));
  const slotH = slotW;
  const fontSize = Math.min(44, Math.max(26, Math.round(slotW * 0.56)));
  return { gap, slotW, slotH, fontSize, spaceWidth };
};
