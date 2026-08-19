/**
 * Minimal dependency-free HTML sanitizer for rich-text content that is stored in
 * the database and rendered as markup.
 *
 * Only a fixed set of formatting tags and attributes survive; everything else
 * (scripts, iframes, event handlers, javascript:/data: URLs, inline styles) is
 * removed. Used for blog article bodies, which are authored in the admin editor
 * but must never be able to run code in a visitor's browser.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins', 'sub', 'sup', 'mark', 'small',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  ol: new Set(['start']),
};

const GLOBAL_ALLOWED_ATTRS = new Set(['class']);

const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i;

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
  if (trimmed === '') return false;
  return SAFE_URL.test(trimmed);
}

function scrubElement(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const tag = el.tagName.toLowerCase();
    const allowedForTag = ALLOWED_ATTRS[tag];
    const permitted = GLOBAL_ALLOWED_ATTRS.has(name) || (allowedForTag?.has(name) ?? false);

    if (!permitted) {
      el.removeAttribute(attr.name);
      continue;
    }

    if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value)) {
      el.removeAttribute(attr.name);
    }
  }

  if (el.tagName.toLowerCase() === 'a' && el.getAttribute('target')) {
    el.setAttribute('rel', 'noopener noreferrer nofollow');
  }
}

/**
 * Returns a sanitized copy of `dirty` that is safe to pass to
 * `dangerouslySetInnerHTML`. Disallowed elements are unwrapped so their text
 * content is preserved, except for script-like elements which are dropped whole.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';

  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    // No DOM available (e.g. during a build-time render): fall back to text.
    return dirty.replace(/<[^>]*>/g, '');
  }

  const doc = new DOMParser().parseFromString(`<div id="__root">${dirty}</div>`, 'text/html');
  const root = doc.getElementById('__root');
  if (!root) return '';

  const DROP_WHOLE = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form', 'input', 'button', 'select', 'textarea', 'svg', 'math', 'template', 'noscript', 'base']);

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();

      if (DROP_WHOLE.has(tag)) {
        child.remove();
        continue;
      }

      walk(child);

      if (!ALLOWED_TAGS.has(tag)) {
        // Unwrap: keep the (already sanitized) children, drop the element.
        const parent = child.parentNode;
        if (parent) {
          while (child.firstChild) parent.insertBefore(child.firstChild, child);
          parent.removeChild(child);
        }
        continue;
      }

      scrubElement(child);
    }
  };

  walk(root);

  return root.innerHTML;
}
