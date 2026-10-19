import postcss from 'postcss';
import type { CssDecl } from '../types.js';

export function parseCss(file: string, source: string): CssDecl[] {
  const decls: CssDecl[] = [];
  const rec = (node: any, selector: string) => {
    for (const child of node.nodes ?? []) {
      if (child.type === 'decl') {
        decls.push({ prop: child.prop, value: String(child.value), selector, loc: { file, line: child.source?.start?.line ?? 0, col: child.source?.start?.column ?? 0 } });
      } else if (child.type === 'rule' || child.type === 'atrule') {
        rec(child, child.type === 'rule' ? child.selector : selector);
      }
    }
  };
  try {
    rec(postcss.parse(source), '');
  } catch (e) {
    throw new Error(`parse-skip: ${(e as Error).message}`);
  }
  return decls;
}
