export function queryRequired(root: ParentNode | null, selector: string): HTMLElement {
  const element = root?.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Expected to find "${selector}"`);
  return element;
}
