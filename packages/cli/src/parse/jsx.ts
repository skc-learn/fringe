import { parse } from '@babel/parser';
import type { Elem } from '../types.js';

function attrValue(v: any): string {
  if (v == null) return 'true';
  if (v.type === 'StringLiteral') return v.value;
  if (v.type === 'JSXExpressionContainer' && v.expression?.type === 'StringLiteral') return v.expression.value;
  return '';
}

/** Collects literal text from an element's children, recursing into nested JSXElements. */
function collectText(node: any): string {
  let t = '';
  for (const c of node.children ?? []) {
    if (c.type === 'JSXText') t += c.value;
    else if (c.type === 'JSXExpressionContainer' && c.expression?.type === 'StringLiteral') t += c.expression.value;
    else if (c.type === 'JSXElement') t += collectText(c);
  }
  return t.trim();
}

export function parseJsx(file: string, source: string): Elem[] {
  let ast;
  try {
    ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'], errorRecovery: false });
  } catch (e) {
    throw new Error(`parse-skip: ${(e as Error).message}`);
  }
  const elems: Elem[] = [];
  (function walkNode(node: any, parent?: { tag: string; attrs: Record<string, string> }) {
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
      if (parent?.attrs?.className !== undefined) el.parentClass = parent.attrs.className;
      elems.push(el);
      nextParent = { tag, attrs };
    }
    for (const k of Object.keys(node)) {
      const c = (node as any)[k];
      if (Array.isArray(c)) c.forEach((x) => typeof x === 'object' && x && typeof x.type === 'string' && walkNode(x, nextParent));
      else if (c && typeof c === 'object' && typeof c.type === 'string') walkNode(c, nextParent);
    }
  })(ast.program);
  return elems;
}
