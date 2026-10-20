import { parse } from 'parse5';
import type { Elem } from '../types.js';

/** Descendant text, matching the JSX parser (a link wrapping <div>text</div> has a name). */
const textOf = (n: any): string => (n.nodeName === '#text' ? n.value : (n.childNodes ?? []).map(textOf).join(''));

export function parseHtml(file: string, source: string): Elem[] {
  const doc = parse(source, { sourceCodeLocationInfo: true });
  const elems: Elem[] = [];
  (function walkNode(node: any, parent?: { tag: string; attrs: Record<string, string>; inLabel?: boolean }) {
    if (node?.tagName) {
      const attrs: Record<string, string> = {};
      for (const a of node.attrs ?? []) attrs[a.name] = a.value;
      const text = textOf(node).trim();
      const el: Elem = { tag: node.tagName, attrs, text, loc: { file, line: node.sourceCodeLocation?.startLine ?? 0, col: node.sourceCodeLocation?.startCol ?? 0 } };
      if (parent) el.parentTag = parent.tag;
      if (parent?.inLabel) el.inLabel = true;
      if (parent?.attrs?.class !== undefined) el.parentClass = parent.attrs.class;
      elems.push(el);
      for (const c of node.childNodes ?? []) walkNode(c, { tag: node.tagName, attrs, inLabel: node.tagName === 'label' || parent?.inLabel });
      return;
    }
    for (const c of node?.childNodes ?? []) walkNode(c, parent);
  })(doc);
  return elems;
}
