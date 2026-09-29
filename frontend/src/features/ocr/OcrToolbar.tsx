import { type Editor, useEditorState } from "@tiptap/react";
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Bold,
    Highlighter,
    IndentDecrease,
    IndentIncrease,
    Italic,
    List,
    ListOrdered,
    type LucideIcon,
    Minus,
    Link2,
    MoreHorizontal,
    Plus as PlusIcon,
    Quote,
        Table as TableIcon,
    Code as CodeIcon,
    Plus,
    Redo2,
    RemoveFormatting,
    Strikethrough,
    Type,
    Underline,
    Undo2,
} from "lucide-react";
import { type ReactNode, useCallback, useId, useState } from "react";
import { BottomSheet } from "@/components/studio/BottomSheet";
import { usePopover } from "@/components/studio/usePopover";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { FONTS, primaryFamily } from "./convert";
import { selectedTextblock, setTextblockAttrs } from "./extensions";

type Align = "left" | "center" | "right" | "justify";
type BlockStyle = "paragraph" | "title" | "heading" | "subheading";

const LEVELS: Record<Exclude<BlockStyle, "paragraph">, 1 | 2 | 3> = { title: 1, heading: 2, subheading: 3 };
const LINE_HEIGHTS = [1, 1.15, 1.3, 1.5, 1.75, 2, 2.5];
const SPACINGS = [0, 4, 8, 12, 18, 24];
const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"];
const ALIGN_ICONS: Record<Align, LucideIcon> = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify };

/** Everything the controls show, read from the editor only when it changes. */
function useFormatState(editor: Editor) {
    return useEditorState({
        editor,
        selector: ({ editor: current }) => {
            const style = current.getAttributes("textStyle");
            const block = selectedTextblock(current);
            const level = current.isActive("heading") ? (current.getAttributes("heading").level as number) : 0;
            return {
                canUndo: current.can().undo(),
                canRedo: current.can().redo(),
                bold: current.isActive("bold"),
                italic: current.isActive("italic"),
                underline: current.isActive("underline"),
                strike: current.isActive("strike"),
                bulletList: current.isActive("bulletList"),
                orderedList: current.isActive("orderedList"),
                inList: current.isActive("listItem"),
                highlight: current.isActive("highlight") ? ((current.getAttributes("highlight").color as string | undefined) ?? HIGHLIGHTS[0]!) : null,
                align: (block?.attrs.textAlign as Align | undefined) ?? "left",
                blockStyle: (level === 1 ? "title" : level === 2 ? "heading" : level === 3 ? "subheading" : "paragraph") as BlockStyle,
                fontFamily: (style.fontFamily as string | undefined) ?? null,
                fontSize: style.fontSize ? Number.parseFloat(style.fontSize as string) : null,
                color: (style.color as string | undefined) ?? null,
                lineHeight: (block?.attrs.lineHeight as number | null) ?? null,
                spacing: (block?.attrs.spacing as number | null) ?? null,
                indent: (block?.attrs.indent as number | undefined) ?? 0,
                link: current.isActive("link") ? ((current.getAttributes("link").href as string | undefined) ?? "") : null,
                blockquote: current.isActive("blockquote"),
                code: current.isActive("code"),
                inTable: current.isActive("table"),
            };
        },
    });
}

type FormatState = ReturnType<typeof useFormatState>;

/** Commands shared by the toolbar and the phone's format sheet. */
function useCommands(editor: Editor) {
    const chain = useCallback(() => editor.chain().focus(), [editor]);
    return {
        setBlockStyle(style: BlockStyle) {
            // Keep the block's own settings (alignment, spacing, its place in the image) when changing its kind.
            chain()
                .command(({ tr, state }) => {
                    const { from, to } = state.selection;
                    state.doc.nodesBetween(from, to, (node, pos) => {
                        if (node.type.name !== "paragraph" && node.type.name !== "heading") return true;
                        const type = style === "paragraph" ? state.schema.nodes.paragraph! : state.schema.nodes.heading!;
                        tr.setNodeMarkup(pos, type, { ...node.attrs, ...(style === "paragraph" ? {} : { level: LEVELS[style] }) });
                        return false;
                    });
                    return true;
                })
                .run();
        },
        setFont(stack: string) {
            chain().setFontFamily(stack).run();
        },
        setSize(size: number) {
            const clamped = Math.max(6, Math.min(144, Math.round(size * 2) / 2));
            chain().setFontSize(`${clamped}px`).run();
        },
        setColor(color: string) {
            chain().setColor(color).run();
        },
        setHighlight(color: string | null) {
            if (color) chain().setHighlight({ color }).run();
            else chain().unsetHighlight().run();
        },
        setAlign(align: Align) {
            chain().setTextAlign(align).run();
        },
        setLineHeight(value: number | null) {
            setTextblockAttrs(editor, () => ({ lineHeight: value }));
        },
        setSpacing(value: number | null) {
            setTextblockAttrs(editor, () => ({ spacing: value }));
        },
        indent(step: 1 | -1, inList: boolean) {
            if (inList) {
                if (step > 0) chain().sinkListItem("listItem").run();
                else chain().liftListItem("listItem").run();
                return;
            }
            setTextblockAttrs(editor, (node) => ({ indent: Math.max(0, Math.min(8, ((node.attrs.indent as number) ?? 0) + step)) }));
        },
    };
}

const buttonClass =
    "grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-secondary transition-colors duration-150 outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-35 aria-pressed:bg-[var(--brand-soft)] aria-pressed:text-[var(--brand)] pointer-coarse:size-10";
const selectClass =
    "h-8 min-w-0 cursor-pointer rounded-lg border border-[var(--card-line)] bg-primary px-2 text-[0.8125rem] text-primary outline-focus-ring hover:border-[var(--color-border-primary)] focus-visible:outline-2 pointer-coarse:h-10";

function ToolButton({ icon: Icon, label, onClick, pressed, disabled }: { icon: LucideIcon; label: string; onClick: () => void; pressed?: boolean; disabled?: boolean }) {
    return (
        <button
            type="button"
            className={buttonClass}
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            disabled={disabled}
            // Keep the text selection: formatting applies to it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
        >
            <Icon className="size-4" aria-hidden />
        </button>
    );
}

const Divider = () => <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-[var(--card-line)]" />;

/** The formatting bar above the page. On phones it's the essentials plus a Format sheet with the rest. */
/** `extended`: the full text editor's extras too — links, quotes, code, tables and dividers. */
export function OcrToolbar({ editor, extended = false }: { editor: Editor; extended?: boolean }) {
    const t = useT();
    const copy = t.ocr.toolbar;
    const state = useFormatState(editor);
    const commands = useCommands(editor);
    const [sheet, setSheet] = useState(false);
    const closeSheet = useCallback(() => setSheet(false), []);

    const history = (
        <>
            <ToolButton icon={Undo2} label={copy.undo} onClick={() => editor.chain().focus().undo().run()} disabled={!state.canUndo} />
            <ToolButton icon={Redo2} label={copy.redo} onClick={() => editor.chain().focus().redo().run()} disabled={!state.canRedo} />
        </>
    );
    const marks = (
        <>
            <ToolButton icon={Bold} label={copy.bold} pressed={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
            <ToolButton icon={Italic} label={copy.italic} pressed={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
            <ToolButton icon={Underline} label={copy.underline} pressed={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        </>
    );

    return (
        <div role="toolbar" aria-label={copy.label} className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--card-line)] bg-primary px-2 py-1.5 lg:flex-wrap lg:overflow-visible">
            {history}
            <Divider />
            {/* Phones: the essentials, and the rest in a sheet. */}
            <div className="flex items-center gap-0.5 lg:hidden">
                {marks}
                <ToolButton icon={List} label={copy.bulletList} pressed={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
                <button type="button" onClick={() => setSheet(true)} className="ml-1 flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--card-line)] px-3 text-sm font-medium text-secondary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2">
                    <Type className="size-4" aria-hidden />
                    {copy.more}
                </button>
            </div>
            <div className="hidden flex-wrap items-center gap-0.5 lg:flex">
                <StyleSelect state={state} onChange={commands.setBlockStyle} />
                <FontSelect state={state} onChange={commands.setFont} />
                <SizeControl state={state} onChange={commands.setSize} />
                <Divider />
                {marks}
                <ToolButton icon={Strikethrough} label={copy.strike} pressed={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
                <ColorControl state={state} onChange={commands.setColor} />
                <HighlightControl state={state} onChange={commands.setHighlight} />
                <Divider />
                <AlignControl state={state} onChange={commands.setAlign} />
                <ToolButton icon={List} label={copy.bulletList} pressed={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
                <ToolButton icon={ListOrdered} label={copy.orderedList} pressed={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
                {extended && <ExtraControls editor={editor} state={state} />}
                <MoreControl state={state} commands={commands} editor={editor} />
            </div>

            <BottomSheet open={sheet} onClose={closeSheet} title={copy.more} closeLabel={copy.done}>
                <SheetRow label={copy.style}>
                    <StyleSelect state={state} onChange={commands.setBlockStyle} wide />
                </SheetRow>
                <SheetRow label={copy.font}>
                    <FontSelect state={state} onChange={commands.setFont} wide />
                </SheetRow>
                <SheetRow label={copy.size}>
                    <SizeControl state={state} onChange={commands.setSize} />
                </SheetRow>
                <div className="flex flex-wrap items-center gap-1">
                    {marks}
                    <ToolButton icon={Strikethrough} label={copy.strike} pressed={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
                    <ColorControl state={state} onChange={commands.setColor} />
                    <HighlightControl state={state} onChange={commands.setHighlight} />
                </div>
                <div className="flex flex-wrap items-center gap-1" aria-label={copy.align} role="group">
                    {(Object.keys(ALIGN_ICONS) as Align[]).map((align) => (
                        <ToolButton key={align} icon={ALIGN_ICONS[align]} label={copy.aligns[align]} pressed={state.align === align} onClick={() => commands.setAlign(align)} />
                    ))}
                    <Divider />
                    <ToolButton icon={List} label={copy.bulletList} pressed={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
                    <ToolButton icon={ListOrdered} label={copy.orderedList} pressed={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
                    <ToolButton icon={IndentDecrease} label={copy.outdent} onClick={() => commands.indent(-1, state.inList)} disabled={!state.inList && state.indent === 0} />
                    <ToolButton icon={IndentIncrease} label={copy.indent} onClick={() => commands.indent(1, state.inList)} />
                    <ToolButton icon={RemoveFormatting} label={copy.clear} onClick={() => editor.chain().focus().unsetAllMarks().run()} />
                </div>
                {extended && (
                    <div className="flex flex-wrap items-center gap-1">
                        <ExtraControls editor={editor} state={state} />
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <SpacingSelects state={state} commands={commands} labelled />
                </div>
            </BottomSheet>
        </div>
    );
}

function SheetRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-secondary">{label}</span>
            {children}
        </div>
    );
}

function StyleSelect({ state, onChange, wide }: { state: FormatState; onChange: (style: BlockStyle) => void; wide?: boolean }) {
    const copy = useT().ocr.toolbar;
    return (
        <select aria-label={copy.style} title={copy.style} value={state.blockStyle} onChange={(event) => onChange(event.target.value as BlockStyle)} className={cn(selectClass, wide ? "w-48" : "w-28")}>
            {(Object.keys(copy.styles) as BlockStyle[]).map((style) => (
                <option key={style} value={style}>
                    {copy.styles[style]}
                </option>
            ))}
        </select>
    );
}

function FontSelect({ state, onChange, wide }: { state: FormatState; onChange: (stack: string) => void; wide?: boolean }) {
    const copy = useT().ocr.toolbar;
    const known = FONTS.find((font) => font.stack === state.fontFamily);
    // A font that isn't on the list (pasted text) still shows by name.
    const value = known?.stack ?? state.fontFamily ?? "";
    return (
        <select aria-label={copy.font} title={copy.font} value={value} onChange={(event) => onChange(event.target.value)} className={cn(selectClass, wide ? "w-48" : "w-36")}>
            {!state.fontFamily && <option value="">{copy.default}</option>}
            {!known && state.fontFamily && <option value={state.fontFamily}>{primaryFamily(state.fontFamily)}</option>}
            {FONTS.map((font) => (
                <option key={font.label} value={font.stack} style={{ fontFamily: font.stack }}>
                    {font.label}
                </option>
            ))}
        </select>
    );
}

function SizeControl({ state, onChange }: { state: FormatState; onChange: (size: number) => void }) {
    const copy = useT().ocr.toolbar;
    const size = state.fontSize ?? 16;
    const step = size >= 24 ? 2 : 1;
    const [draft, setDraft] = useState<string | null>(null);
    const commit = () => {
        const value = Number.parseFloat(draft ?? "");
        if (Number.isFinite(value) && value > 0) onChange(value);
        setDraft(null);
    };
    return (
        <span className="flex items-center">
            <ToolButton icon={Minus} label={copy.smaller} onClick={() => onChange(size - step)} />
            <input
                aria-label={copy.size}
                title={copy.size}
                inputMode="decimal"
                value={draft ?? (state.fontSize === null ? "" : String(size))}
                placeholder="16"
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        commit();
                    }
                }}
                className="h-8 w-11 rounded-lg border border-[var(--card-line)] bg-primary text-center text-[0.8125rem] text-primary tabular-nums outline-focus-ring focus-visible:outline-2 pointer-coarse:h-10"
            />
            <ToolButton icon={Plus} label={copy.larger} onClick={() => onChange(size + step)} />
        </span>
    );
}

function ColorControl({ state, onChange }: { state: FormatState; onChange: (color: string) => void }) {
    const copy = useT().ocr.toolbar;
    const id = useId();
    const colour = state.color ?? "#1a1a1a";
    return (
        <label htmlFor={id} title={copy.color} className={cn(buttonClass, "relative")}>
            <span className="sr-only">{copy.color}</span>
            <span aria-hidden className="flex flex-col items-center leading-none">
                <span className="text-[0.8125rem] font-semibold">A</span>
                <span className="mt-0.5 h-1 w-4 rounded-full" style={{ background: colour }} />
            </span>
            <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(colour) ? colour : "#1a1a1a"} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
    );
}

function HighlightControl({ state, onChange }: { state: FormatState; onChange: (color: string | null) => void }) {
    const copy = useT().ocr.toolbar;
    const { open, setOpen, wrap, trigger } = usePopover();
    return (
        <div ref={wrap} className="relative">
            <button
                ref={trigger}
                type="button"
                className={buttonClass}
                aria-label={copy.highlight}
                title={copy.highlight}
                aria-expanded={open}
                aria-pressed={Boolean(state.highlight)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setOpen((value) => !value)}
            >
                <Highlighter className="size-4" aria-hidden />
            </button>
            {open && (
                <div className="absolute top-full left-0 z-30 mt-1 flex items-center gap-1 rounded-xl border border-[var(--card-line)] bg-primary p-1.5 shadow-lg">
                    {HIGHLIGHTS.map((colour) => (
                        <button
                            key={colour}
                            type="button"
                            aria-label={`${copy.highlight} ${colour}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                                onChange(colour);
                                setOpen(false);
                            }}
                            className={cn("size-7 cursor-pointer rounded-md border border-black/10 outline-focus-ring focus-visible:outline-2", state.highlight === colour && "ring-2 ring-[var(--brand)]")}
                            style={{ background: colour }}
                        />
                    ))}
                    <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                            onChange(null);
                            setOpen(false);
                        }}
                        className="h-7 cursor-pointer rounded-md px-2 text-xs font-medium text-secondary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2"
                    >
                        {copy.none}
                    </button>
                </div>
            )}
        </div>
    );
}

function SpacingSelects({ state, commands, labelled }: { state: FormatState; commands: ReturnType<typeof useCommands>; labelled?: boolean }) {
    const copy = useT().ocr.toolbar;
    const lineHeight = (
        <select aria-label={copy.lineHeight} title={copy.lineHeight} value={state.lineHeight ?? ""} onChange={(event) => commands.setLineHeight(event.target.value ? Number(event.target.value) : null)} className={cn(selectClass, labelled ? "w-full" : "w-[4.5rem]")}>
            <option value="">{labelled ? copy.default : "↕"}</option>
            {[...new Set([...LINE_HEIGHTS, ...(state.lineHeight ? [state.lineHeight] : [])])]
                .sort((a, b) => a - b)
                .map((value) => (
                    <option key={value} value={value}>
                        {value.toFixed(2).replace(/0$/, "")}
                    </option>
                ))}
        </select>
    );
    const spacing = (
        <select aria-label={copy.spacing} title={copy.spacing} value={state.spacing ?? ""} onChange={(event) => commands.setSpacing(event.target.value === "" ? null : Number(event.target.value))} className={cn(selectClass, labelled ? "w-full" : "w-[4.5rem]")}>
            <option value="">{labelled ? copy.default : "¶"}</option>
            {SPACINGS.map((value) => (
                <option key={value} value={value}>
                    {value}px
                </option>
            ))}
        </select>
    );
    if (!labelled) {
        return (
            <>
                {lineHeight}
                {spacing}
            </>
        );
    }
    return (
        <>
            <label className="flex flex-col gap-1 text-xs font-medium text-secondary">
                {copy.lineHeight}
                {lineHeight}
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-secondary">
                {copy.spacing}
                {spacing}
            </label>
        </>
    );
}

/** A popover anchored under its toolbar button. */
function ToolPopover({ icon: Icon, label, pressed, children }: { icon: LucideIcon; label: string; pressed?: boolean; children: (close: () => void) => ReactNode }) {
    const { open, setOpen, wrap, trigger } = usePopover();
    return (
        <div ref={wrap} className="relative">
            <button
                ref={trigger}
                type="button"
                className={buttonClass}
                aria-label={label}
                title={label}
                aria-expanded={open}
                aria-haspopup="true"
                aria-pressed={pressed}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setOpen((value) => !value)}
            >
                <Icon className="size-4" aria-hidden />
            </button>
            {open && <div className="absolute top-full left-0 z-30 mt-1 flex items-center gap-1 rounded-xl border border-[var(--card-line)] bg-primary p-1.5 shadow-lg">{children(() => setOpen(false))}</div>}
        </div>
    );
}

function AlignControl({ state, onChange }: { state: FormatState; onChange: (align: Align) => void }) {
    const copy = useT().ocr.toolbar;
    return (
        <ToolPopover icon={ALIGN_ICONS[state.align]} label={copy.align}>
            {(close) =>
                (Object.keys(ALIGN_ICONS) as Align[]).map((align) => (
                    <ToolButton
                        key={align}
                        icon={ALIGN_ICONS[align]}
                        label={copy.aligns[align]}
                        pressed={state.align === align}
                        onClick={() => {
                            onChange(align);
                            close();
                        }}
                    />
                ))
            }
        </ToolPopover>
    );
}

/** Spacing, indent and clearing — used less, so one step away. */
function MoreControl({ state, commands, editor }: { state: FormatState; commands: ReturnType<typeof useCommands>; editor: Editor }) {
    const copy = useT().ocr.toolbar;
    return (
        <ToolPopover icon={MoreHorizontal} label={copy.moreOptions}>
            {() => (
                <div className="flex w-64 flex-col gap-3 p-1.5">
                    <div className="grid grid-cols-2 gap-2">
                        <SpacingSelects state={state} commands={commands} labelled />
                    </div>
                    <div className="flex items-center gap-1">
                        <ToolButton icon={IndentDecrease} label={copy.outdent} onClick={() => commands.indent(-1, state.inList)} disabled={!state.inList && state.indent === 0} />
                        <ToolButton icon={IndentIncrease} label={copy.indent} onClick={() => commands.indent(1, state.inList)} />
                        <Divider />
                        <ToolButton icon={RemoveFormatting} label={copy.clear} onClick={() => editor.chain().focus().unsetAllMarks().run()} />
                    </div>
                </div>
            )}
        </ToolPopover>
    );
}

/** Accepts "example.com" as https://example.com; only web and mail links. */
function normaliseUrl(value: string): string | null {
    const text = value.trim();
    if (!text) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
    try {
        const url = new URL(withScheme);
        return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

function LinkControl({ editor, href }: { editor: Editor; href: string | null }) {
    const copy = useT().ocr.toolbar;
    const [value, setValue] = useState("");
    const [invalid, setInvalid] = useState(false);
    const id = useId();
    return (
        <ToolPopover icon={Link2} label={copy.link} pressed={href !== null}>
            {(close) => (
                <form
                    className="flex w-72 flex-col gap-2 p-1"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const url = normaliseUrl(value || href || "");
                        if (!url) return setInvalid(true);
                        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                        setInvalid(false);
                        close();
                    }}
                >
                    <label htmlFor={id} className="text-xs font-medium text-secondary">
                        {copy.linkUrl}
                    </label>
                    <input
                        id={id}
                        autoFocus
                        defaultValue={href ?? ""}
                        onChange={(event) => setValue(event.target.value)}
                        placeholder="https://"
                        aria-invalid={invalid}
                        className={cn("h-9 rounded-lg border bg-primary px-2.5 text-sm text-primary outline-focus-ring focus-visible:outline-2", invalid ? "border-error_subtle" : "border-[var(--card-line)]")}
                    />
                    {invalid && <p className="text-xs text-error-primary">{copy.linkInvalid}</p>}
                    <div className="flex justify-end gap-2">
                        {href !== null && (
                            <button
                                type="button"
                                onClick={() => {
                                    editor.chain().focus().extendMarkRange("link").unsetLink().run();
                                    close();
                                }}
                                className="h-8 cursor-pointer rounded-lg px-2.5 text-sm font-medium text-secondary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2"
                            >
                                {copy.removeLink}
                            </button>
                        )}
                        <button type="submit" className="h-8 cursor-pointer rounded-lg bg-brand-solid px-3 text-sm font-semibold text-white outline-focus-ring focus-visible:outline-2">
                            {copy.apply}
                        </button>
                    </div>
                </form>
            )}
        </ToolPopover>
    );
}

function MenuItem({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className="flex h-9 w-full cursor-pointer items-center rounded-lg px-2.5 text-left text-sm text-secondary outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
            {label}
        </button>
    );
}

/** Links, quotes, code, and what can be inserted: code blocks, tables, dividers — and table editing when in one. */
function ExtraControls({ editor, state }: { editor: Editor; state: FormatState }) {
    const copy = useT().ocr.toolbar;
    const run = (command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>, close: () => void) => {
        command(editor.chain().focus()).run();
        close();
    };
    return (
        <>
            <Divider />
            <LinkControl editor={editor} href={state.link} />
            <ToolButton icon={Quote} label={copy.quote} pressed={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
            <ToolButton icon={CodeIcon} label={copy.code} pressed={state.code} onClick={() => editor.chain().focus().toggleCode().run()} />
            <ToolPopover icon={PlusIcon} label={copy.insert}>
                {(close) => (
                    <div className="flex w-48 flex-col p-0.5">
                        <MenuItem label={copy.codeBlock} onClick={() => run((chain) => chain.toggleCodeBlock(), close)} />
                        <MenuItem label={copy.insertTable} onClick={() => run((chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }), close)} />
                        <MenuItem label={copy.divider} onClick={() => run((chain) => chain.setHorizontalRule(), close)} />
                    </div>
                )}
            </ToolPopover>
            {state.inTable && (
                <ToolPopover icon={TableIcon} label={copy.table}>
                    {(close) => (
                        <div className="flex w-48 flex-col p-0.5">
                            <MenuItem label={copy.addRow} onClick={() => run((chain) => chain.addRowAfter(), close)} />
                            <MenuItem label={copy.addColumn} onClick={() => run((chain) => chain.addColumnAfter(), close)} />
                            <MenuItem label={copy.deleteRow} onClick={() => run((chain) => chain.deleteRow(), close)} />
                            <MenuItem label={copy.deleteColumn} onClick={() => run((chain) => chain.deleteColumn(), close)} />
                            <MenuItem label={copy.deleteTable} onClick={() => run((chain) => chain.deleteTable(), close)} />
                        </div>
                    )}
                </ToolPopover>
            )}
        </>
    );
}
