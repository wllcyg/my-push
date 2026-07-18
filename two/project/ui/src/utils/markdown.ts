// ============================================================
// Markdown Renderer — marked + highlight.js + KaTeX pipeline
// ============================================================

import { marked, type Renderer } from 'marked'
import hljs from 'highlight.js'
import katex from 'katex'
import DOMPurify, { type Config } from 'dompurify'

// ── Configure marked ────────────────────────────────────────

const renderer: Partial<Renderer> = {
  // Code blocks — delegate syntax highlighting to highlight.js
  // We inject data attributes so CodeBlock.vue can enhance them
  code({ text, lang }) {
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
    let highlighted: string
    try {
      highlighted = language !== 'plaintext'
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value
    } catch {
      highlighted = text
    }
    const escapedLang = language.replace(/"/g, '&quot;')
    const escapedCode = text.replace(/`/g, '&#96;')
    return `<div class="code-block-wrapper" data-lang="${escapedLang}" data-raw="${encodeURIComponent(escapedCode)}">
  <div class="code-block-header">
    <span class="code-lang-label">${escapedLang}</span>
    <button class="code-copy-btn" aria-label="Copy code" data-code="${encodeURIComponent(escapedCode)}">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      <span class="copy-label">Copy</span>
    </button>
  </div>
  <pre><code class="hljs language-${escapedLang}">${highlighted}</code></pre>
</div>`
  },
}

marked.use({
  renderer: renderer as Renderer,
  breaks: true,
  gfm: true,
})

// ── KaTeX — inline and block math ──────────────────────────

const BLOCK_MATH_RE = /\$\$([\s\S]+?)\$\$/g
const INLINE_MATH_RE = /\$([^\n$]+?)\$/g

function renderMath(text: string): string {
  // Block math first ($$...$$)
  text = text.replace(BLOCK_MATH_RE, (_match, formula: string) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false })
    } catch {
      return `<span class="math-error">${formula}</span>`
    }
  })

  // Inline math ($...$)
  text = text.replace(INLINE_MATH_RE, (_match, formula: string) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false })
    } catch {
      return `<span class="math-error">${formula}</span>`
    }
  })

  return text
}

// ── DOMPurify config ────────────────────────────────────────

const DOMPURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'input',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'img', 'hr',
    // Code blocks
    'div', 'span', 'button', 'svg', 'path', 'rect',
    // KaTeX
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'mfrac',
    'msqrt', 'mroot', 'munder', 'mover', 'munderover',
    'msub', 'msup', 'msubsup', 'annotation', 'annotation-xml',
    'mtable', 'mtr', 'mtd', 'maligngroup', 'malignmark',
    'menclose', 'mfenced', 'mpadded', 'mphantom', 'mspace', 
    'mstyle', 'mtext',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'type', 'checked', 'disabled',
    'aria-label', 'aria-hidden', 'data-lang', 'data-raw', 'data-code',
    // SVG
    'xmlns', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width',
    'stroke-linecap', 'stroke-linejoin', 'd', 'rx', 'ry', 'x', 'y',
    // KaTeX
    'display', 'style', 'encoding', 'mathvariant',
  ],
  ADD_ATTR: ['target'],
  FORCE_BODY: false,
}

// ── Public API ──────────────────────────────────────────────

/**
 * Renders a markdown string to safe HTML.
 * Pipeline: math pre-process → marked → DOMPurify sanitize
 */
export function renderMarkdown(input: string): string {
  if (!input) return ''

  // 1. Pre-process math before marked touches it
  const withMath = renderMath(input)

  // 2. Parse markdown
  const rawHtml = marked.parse(withMath) as string

  // 3. Sanitize
  const clean = DOMPurify.sanitize(rawHtml, DOMPURIFY_CONFIG) as string

  return clean
}

/**
 * Attaches copy-to-clipboard behavior to all code copy buttons
 * inside a given container. Call after v-html renders.
 */
export function attachCodeCopyHandlers(container: HTMLElement): void {
  const buttons = container.querySelectorAll<HTMLButtonElement>('.code-copy-btn')
  buttons.forEach((btn) => {
    // Remove existing listener first to prevent duplicates
    const clone = btn.cloneNode(true) as HTMLButtonElement
    btn.parentNode?.replaceChild(clone, btn)

    clone.addEventListener('click', async () => {
      const encoded = clone.dataset.code ?? ''
      const code = decodeURIComponent(encoded)
      try {
        await navigator.clipboard.writeText(code)
        const label = clone.querySelector('.copy-label')
        if (label) {
          label.textContent = 'Copied!'
          setTimeout(() => { label.textContent = 'Copy' }, 2000)
        }
        clone.classList.add('copied')
        setTimeout(() => clone.classList.remove('copied'), 2000)
      } catch {
        // Clipboard not available
      }
    })
  })
}
