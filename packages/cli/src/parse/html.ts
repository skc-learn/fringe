import { parse } from 'parse5';
import type { Elem } from '../types.js';

export function parseHtml(file: string, source: string): Elem[] {
  const doc = parse(source, { sourceCodeLocationInfo: true });
  const elems: Elem[] = [];
  (function walkNode(node: any) {
    if (node?.tagName) {
      const attrs: Record<string, string> = {};
      for (const a of node.attrs ?? []) attrs[a.name] = a.value;
      const text = (node.childNodes ?? [])
        .filter((c: any) => c.nodeName === '#text')
        .map((c: any) => c.value)
        .join('')
        .trim();
      elems.push({ tag: node.tagName, attrs, text, loc: { file, line: node.sourceCodeLocation?.startLine ?? 0, col: node.sourceCodeLocation?.startCol ?? 0 } });
    }
    for (const c of node?.childNodes ?? []) walkNode(c);
  })(doc);
  return elems;
}
