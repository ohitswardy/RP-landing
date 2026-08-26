import { useEffect, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import type { UploadScope } from '../store';
import ImagePicker from './ImagePicker';
import {
  IconAlignCenter, IconAlignJustify, IconAlignLeft, IconAlignRight,
  IconImage, IconIndent, IconLink, IconListBullets, IconListNumbers,
  IconMinus, IconOutdent, IconRedo, IconTable, IconTrash, IconUndo,
} from '../icons';

/* ─────────────────────────────────────────────────────────────
   House rich-text field: TipTap with a Word-like toolbar limited
   to what the mailer template prints — emphasis, alignment, lists,
   links, inline images, tables, horizontal rules. Value is an HTML
   string; an empty document round-trips as ''.
   ───────────────────────────────────────────────────────────── */

/** Escape a plain-text chunk for safe embedding in HTML. */
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function looksLikeHtml(text: string): boolean {
  return /<[a-z][^>]*>/i.test(text);
}

/** Upgrade the legacy plain-text convention ("- " bullets, two
    leading spaces for a sub-bullet) into the editor's HTML. */
export function plainToHtml(text: string): string {
  if (!text.trim()) return '';
  if (looksLikeHtml(text)) return text;

  const out: string[] = [];
  let depth = 0; // 0 = outside lists, 1 = in <ul>, 2 = in nested <ul>

  const closeTo = (level: number) => {
    while (depth > level) { out.push('</ul>'); depth -= 1; }
  };

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const sub = /^\s{2,}-\s+/.test(line);
    const top = /^-\s+/.test(line.trim());
    if (sub || top) {
      const want = sub ? 2 : 1;
      while (depth < want) { out.push('<ul>'); depth += 1; }
      closeTo(want);
      out.push(`<li><p>${esc(line.trim().replace(/^-\s+/, ''))}</p></li>`);
    } else {
      closeTo(0);
      out.push(`<p>${esc(line.trim())}</p>`);
    }
  }
  closeTo(0);
  return out.join('');
}

/* ── Toolbar ───────────────────────────────────────────────── */

function ToolBtn({ label, active = false, disabled = false, onClick, children }: {
  label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      /* mousedown, so the editor selection is not blurred away first */
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`grid h-7 min-w-7 place-items-center border px-1 text-[11px] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px" style={{ background: 'color-mix(in oklab, var(--color-ink) 18%, transparent)' }} />;
}

function Toolbar({ editor, onPickImage }: { editor: Editor; onPickImage?: () => void }) {
  const chain = () => editor.chain().focus();

  function editLink() {
    const current = (editor.getAttributes('link').href as string | undefined) ?? '';
    // eslint-disable-next-line no-alert
    const href = window.prompt('Link address (empty removes the link):', current);
    if (href === null) return;
    if (!href.trim()) chain().extendMarkRange('link').unsetLink().run();
    else chain().extendMarkRange('link').setLink({ href: href.trim() }).run();
  }

  return (
    <div className="border-b rule bg-bone px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <ToolBtn label="Undo" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><IconUndo /></ToolBtn>
        <ToolBtn label="Redo" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><IconRedo /></ToolBtn>
        <Divider />
        <ToolBtn label="Bold" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}>
          <span className="font-bold">B</span>
        </ToolBtn>
        <ToolBtn label="Italic" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolBtn>
        <ToolBtn label="Underline" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}>
          <span className="underline">U</span>
        </ToolBtn>
        <Divider />
        <ToolBtn label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><IconAlignLeft /></ToolBtn>
        <ToolBtn label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><IconAlignCenter /></ToolBtn>
        <ToolBtn label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><IconAlignRight /></ToolBtn>
        <ToolBtn label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()}><IconAlignJustify /></ToolBtn>
        <Divider />
        <ToolBtn label="Bullet list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><IconListBullets /></ToolBtn>
        <ToolBtn label="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><IconListNumbers /></ToolBtn>
        <ToolBtn label="Decrease indent" disabled={!editor.can().liftListItem('listItem')} onClick={() => chain().liftListItem('listItem').run()}><IconOutdent /></ToolBtn>
        <ToolBtn label="Increase indent" disabled={!editor.can().sinkListItem('listItem')} onClick={() => chain().sinkListItem('listItem').run()}><IconIndent /></ToolBtn>
        <Divider />
        <ToolBtn label="Insert or edit link" active={editor.isActive('link')} onClick={editLink}><IconLink /></ToolBtn>
        {onPickImage && <ToolBtn label="Insert image" onClick={onPickImage}><IconImage size={14} /></ToolBtn>}
        <ToolBtn
          label="Insert table"
          active={editor.isActive('table')}
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <IconTable />
        </ToolBtn>
        <ToolBtn label="Horizontal line" onClick={() => chain().setHorizontalRule().run()}><IconMinus /></ToolBtn>
      </div>

      {/* Table controls appear only while the caret is inside one */}
      {editor.isActive('table') && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t rule pt-1.5">
          <TableTxt label="Add a row below the current one" onClick={() => chain().addRowAfter().run()}>+ Row</TableTxt>
          <TableTxt label="Add a column to the right" onClick={() => chain().addColumnAfter().run()}>+ Column</TableTxt>
          <TableTxt label="Delete the current row" onClick={() => chain().deleteRow().run()}>− Row</TableTxt>
          <TableTxt label="Delete the current column" onClick={() => chain().deleteColumn().run()}>− Column</TableTxt>
          <TableTxt label="Toggle header row" onClick={() => chain().toggleHeaderRow().run()}>Header</TableTxt>
          <ToolBtn label="Delete table" onClick={() => chain().deleteTable().run()}><IconTrash size={12} /></ToolBtn>
        </div>
      )}
    </div>
  );
}

function TableTxt({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="mono border rule px-2 py-1 text-[9.5px] uppercase tracking-[0.1em] text-graphite transition-colors duration-200 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
    >
      {children}
    </button>
  );
}

/* ── Field ─────────────────────────────────────────────────── */

export default function RichTextField({
  label, value, onChange, hint, rows = 4, images,
}: {
  label: string;
  /** HTML document; '' when empty. */
  value: string;
  onChange: (html: string) => void;
  hint?: string;
  rows?: number;
  /** Enables the insert-image button; uploads file into the media library. */
  images?: { scope: UploadScope; usedBy: string };
}) {
  const [picking, setPicking] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        link: { openOnClick: false },
      }),
      TextAlign.configure({ types: ['paragraph'] }),
      Image,
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: plainToHtml(value),
    // The toolbar reads isActive()/can() on every render, so keep
    // rendering in step with the editor's transactions.
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  // Adopt external value changes (duplicate seeding, discard) without
  // fighting the user's own keystrokes echoing back through props.
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (value !== current) editor.commands.setContent(plainToHtml(value), { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">{label}</label>
      <div className="border rule bg-white transition-colors duration-300 focus-within:border-[color:var(--color-amber-deep)]">
        {editor && <Toolbar editor={editor} onPickImage={images ? () => setPicking(true) : undefined} />}
        <EditorContent
          editor={editor}
          style={{ ['--rt-min-h' as string]: `${rows * 24}px` }}
          className="min-w-0 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink [overflow-wrap:anywhere]
            [&_.ProseMirror]:min-h-[var(--rt-min-h)] [&_.ProseMirror]:outline-none
            [&_table]:table-fixed
            [&_p]:my-0.5 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle]
            [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5
            [&_a]:text-navy [&_a]:underline
            [&_img]:my-2 [&_img]:max-w-full
            [&_hr]:my-3 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[color:var(--color-silver)]
            [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse
            [&_th]:border [&_th]:border-[color:var(--color-silver)] [&_th]:bg-bone [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold
            [&_td]:border [&_td]:border-[color:var(--color-silver)] [&_td]:px-2 [&_td]:py-1 [&_td]:align-top
            [&_.selectedCell]:bg-bone"
        />
      </div>
      {hint && <p className="text-[11.5px] leading-relaxed text-graphite">{hint}</p>}

      {images && (
        <ImagePicker
          open={picking}
          title="Insert image"
          usedBy={images.usedBy}
          scope={images.scope}
          kind="graphic"
          aspect="4/3"
          hint="The image drops in at the caret and prints at the width it fits."
          onPick={(path) => {
            // Follow the image with an empty paragraph so the caret lands
            // below it — the next insert or keystroke adds, never replaces.
            editor?.chain().focus()
              .insertContent([{ type: 'image', attrs: { src: path } }, { type: 'paragraph' }])
              .run();
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
