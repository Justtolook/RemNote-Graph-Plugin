/**
 * Minimal, synchronous helpers for RemNote rich text.
 *
 * Rich text is an array of strings and element objects. The element type lives in `i`:
 *   'm' text with formatting, 'q' Rem reference, 'x' LaTeX, 'i' image, ...
 * We only need two things from it: the plain text (for labels and search) and the
 * ids of referenced Rems (for reference edges). Doing this locally avoids one
 * plugin bridge call per Rem, which is what made the old implementation slow.
 */

export type RichTextElement = string | { i?: string; _id?: string; text?: unknown; [key: string]: unknown };
export type RichText = RichTextElement[];

const REM_REFERENCE = 'q';

function asArray(richText: unknown): RichTextElement[] {
  return Array.isArray(richText) ? (richText as RichTextElement[]) : [];
}

/** Ids of all Rems referenced inside a rich text, in order of appearance, without duplicates. */
export function referencedRemIds(richText: unknown): string[] {
  const ids: string[] = [];
  for (const el of asArray(richText)) {
    if (el && typeof el === 'object' && el.i === REM_REFERENCE && typeof el._id === 'string') {
      if (!ids.includes(el._id)) ids.push(el._id);
    }
  }
  return ids;
}

/**
 * Plain text of a rich text. References are resolved with `resolveReference`
 * (if given) so that "[[Topic]]" shows up as "Topic" instead of disappearing.
 */
export function richTextToPlain(
  richText: unknown,
  resolveReference?: (remId: string) => string | undefined
): string {
  let out = '';
  for (const el of asArray(richText)) {
    if (typeof el === 'string') {
      out += el;
    } else if (el && typeof el === 'object') {
      if (el.i === REM_REFERENCE && typeof el._id === 'string') {
        const resolved = resolveReference?.(el._id);
        out += resolved ?? richTextToPlain(el.textOfDeletedRem);
      } else if (typeof el.text === 'string') {
        // formatted text ('m'), LaTeX ('x'), global names, ...
        out += el.text;
      }
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}
