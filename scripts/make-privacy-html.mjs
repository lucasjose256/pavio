// Converte store/privacy-policy.md em store/privacy-policy.html (página estática, sem dependências, pronta para hospedar).
import { readFileSync, writeFileSync } from 'node:fs';

const md = readFileSync('store/privacy-policy.md', 'utf8').split('\n');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');

let html = '';
let list = false;
let table = null;
const closeList = () => { if (list) { html += '</ul>\n'; list = false; } };
const closeTable = () => { if (table) { html += '</tbody></table>\n'; table = null; } };

for (const line of md) {
  if (line.startsWith('|')) {
    closeList();
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (!table) { table = 'head'; html += `<table><thead><tr>${cells.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>\n`; }
    else if (table === 'head' && cells.every((c) => /^-+$/.test(c))) table = 'body';
    else html += `<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>\n`;
    continue;
  }
  closeTable();
  if (line.startsWith('- ')) { if (!list) { html += '<ul>\n'; list = true; } html += `<li>${inline(line.slice(2))}</li>\n`; continue; }
  closeList();
  if (line.startsWith('# ')) html += `<h1>${inline(line.slice(2))}</h1>\n`;
  else if (line.startsWith('## ')) html += `<h2>${inline(line.slice(3))}</h2>\n`;
  else if (line.trim()) html += `<p>${inline(line)}</p>\n`;
}
closeList(); closeTable();

const page = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Política de Privacidade — Pavio</title>
<style>
  :root { color-scheme: light dark; --bg:#fbf3e4; --surface:#fffaf0; --text:#4a3426; --muted:#8a7460; --accent:#a8531c; --border:#e6d4b5; }
  @media (prefers-color-scheme: dark) { :root { --bg:#1d1713; --surface:#272019; --text:#f3e6d0; --muted:#b3a089; --accent:#f2b361; --border:#44372a; } }
  body { margin:0; background:var(--bg); color:var(--text); font:17px/1.65 ui-rounded, system-ui, -apple-system, 'Segoe UI', sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }
  h1 { font: 600 38px/1.2 'Iowan Old Style', Georgia, serif; color: var(--accent); margin: 0 0 8px; }
  h2 { font: 600 24px/1.3 'Iowan Old Style', Georgia, serif; margin: 38px 0 6px; }
  p, li { margin: 8px 0; } ul { padding-left: 22px; }
  code { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1px 6px; font-size: .9em; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 15px; }
  th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: .06em; }
</style>
</head>
<body><main>
${html}</main></body>
</html>
`;
writeFileSync('store/privacy-policy.html', page);
console.log('store/privacy-policy.html gerado');
