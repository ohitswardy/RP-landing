import { Fragment } from 'react';

/** Marks the searched words inside a result, the way a results list should
    show you why a row came back. Falls back to plain text with no query. */
export default function Highlight({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0 || !text) return <>{text}</>;

  const pattern = words
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
    .join('|');

  let parts: string[];
  try {
    parts = text.split(new RegExp(`(${pattern})`, 'gi'));
  } catch {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, i) => (
        // split() with one capture group puts the matches on the odd indices.
        i % 2 === 1 ? (
          <mark
            key={i}
            className="px-[1px]"
            style={{ background: 'color-mix(in oklab, var(--color-amber) 34%, transparent)', color: 'inherit' }}
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      ))}
    </>
  );
}
