import { Parser } from 'acorn';
import { tsPlugin } from '@sveltejs/acorn-typescript';
import type { Elem } from '../types.js';

// acorn + its TypeScript plugin instead of Babel: small enough to ship readable inside the Claude Code plugin (each vendored
// file must stay under 256 KiB), with the same JSX element count as Babel on 1,000+ real files. `.ts` files are parsed without
// JSX first, because a generic arrow `<T>(x: T) => x` is ambiguous with a JSX tag.
const TSX = Parser.extend(tsPlugin({ jsx: true }) as never);
const TS = Parser.extend(tsPlugin({ jsx: false }) as never);

function parseProgram(file: string, source: string): any {
  const order = /\.(ts|mts|cts)$/.test(file) ? [TS, TSX] : [TSX, TS];
  let first: unknown;
  for (const P of order) {
    for (const sourceType of ['module', 'script'] as const) {
      try { return P.parse(source, { ecmaVersion: 'latest', sourceType, locations: true } as never); }
      catch (e) { first ??= e; }
    }
  }
  throw first;
}

function attrValue(v: any): string {
  if (v == null) return 'true';
  if (v.type === 'Literal' && typeof v.value === 'string') return v.value;
  if (v.type === 'JSXExpressionContainer' && v.expression?.type === 'Literal' && typeof v.expression.value === 'string') return v.expression.value;
  // Dynamic value: present but unknowable. Non-empty so name/label rules don't flag `title={t('x')}`.
  return '{…}';
}

/** Collects literal text from an element's children, recursing into nested JSXElements. */
function collectText(node: any): string {
  let t = '';
  for (const c of node.children ?? []) {
    if (c.type === 'JSXText') t += c.value;
    else if (c.type === 'JSXExpressionContainer' && c.expression?.type === 'Literal' && typeof c.expression.value === 'string') t += c.expression.value;
    else if (c.type === 'JSXExpressionContainer' && c.expression?.type !== 'JSXEmptyExpression') t += '{…}';
    else if (c.type === 'JSXElement') t += collectText(c);
  }
  return t.trim();
}

export function parseJsx(file: string, source: string): Elem[] {
  let ast;
  try {
    ast = parseProgram(file, source);
  } catch (e) {
    throw new Error(`parse-skip: ${(e as Error).message}`);
  }
  const elems: Elem[] = [];
  (function walkNode(node: any, parent?: { tag: string; attrs: Record<string, string>; inLabel?: boolean }) {
    if (!node || typeof node.type !== 'string') return;
    let nextParent = parent;
    if (node.type === 'JSXElement') {
      const nameNode = node.openingElement.name;
      const tag = nameNode.type === 'JSXIdentifier' ? nameNode.name : `${nameNode.object?.name ?? ''}.${nameNode.property?.name ?? ''}`;
      const attrs: Record<string, string> = {};
      for (const a of node.openingElement.attributes) {
        if (a.type === 'JSXAttribute') attrs[a.name.name as string] = attrValue(a.value);
      }
      const el: Elem = { tag, attrs, text: collectText(node), loc: { file, line: node.loc?.start.line ?? 0, col: node.loc?.start.column ?? 0 } };
      if (parent) el.parentTag = parent.tag;
      if (parent?.inLabel) el.inLabel = true;
      if (parent?.attrs?.className !== undefined) el.parentClass = parent.attrs.className;
      elems.push(el);
      nextParent = { tag, attrs, inLabel: tag === 'label' || parent?.inLabel };
    }
    for (const k of Object.keys(node)) {
      const c = (node as any)[k];
      if (Array.isArray(c)) c.forEach((x) => typeof x === 'object' && x && typeof x.type === 'string' && walkNode(x, nextParent));
      else if (c && typeof c === 'object' && typeof c.type === 'string') walkNode(c, nextParent);
    }
  })(ast);
  return elems;
}
