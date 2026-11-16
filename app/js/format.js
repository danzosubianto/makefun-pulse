// Small formatting helpers shared by every view: money, dates, ticking
// countdowns, HTML escaping and a deliberately tiny Markdown renderer for the
// description / rules text the API returns (headings, emphasis, code, lists,
// links and paragraphs — nothing else, and all input is escaped first).

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// "$1,325" / "$623.50" — whole dollars stay whole, cents show when present.
export function money(value) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (n == null || Number.isNaN(n)) return '—';
  const opts = Number.isInteger(n)
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return '$' + n.toLocaleString('en-US', opts);
}

export function num(value) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US');
}

export function dateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

export function dateOnly(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// "12d 4h", "3h 12m", "41m 09s", "12s" — or "closed" once the deadline passed.
export function timeLeft(iso, now = Date.now()) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - now;
  if (Number.isNaN(ms)) return '—';
  if (ms <= 0) return 'closed';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function isLive(item, now = Date.now()) {
  const t = new Date(item.deadline).getTime();
  return !Number.isNaN(t) && t > now;
}

function inlineMd(text) {
  // Input is already HTML-escaped; add the inline marks back in.
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

// Render the API's Markdown-ish prose to safe HTML, block by block.
export function renderMarkdown(md) {
  if (!md) return '';
  const lines = esc(md).split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol' | null
  let para = [];
  const flushPara = () => {
    if (para.length) { out.push(`<p>${inlineMd(para.join(' '))}</p>`); para = []; }
  };
  const flushList = () => {
    if (list) { out.push(`</${list}>`); list = null; }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      flushPara(); flushList();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`);
    } else if (/^---+$/.test(line.trim())) {
      flushPara(); flushList(); out.push('<hr>');
    } else if (bullet || numbered) {
      flushPara();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) { flushList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inlineMd((bullet || numbered)[1])}</li>`);
    } else if (line.trim() === '') {
      flushPara(); flushList();
    } else if (/^&gt;\s?/.test(line)) {
      flushPara(); flushList();
      out.push(`<blockquote>${inlineMd(line.replace(/^&gt;\s?/, ''))}</blockquote>`);
    } else {
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return out.join('\n');
}
