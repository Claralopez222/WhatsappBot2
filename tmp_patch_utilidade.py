from pathlib import Path
import re
p = Path('src/handlers/utilidade.js')
text = p.read_text(encoding='utf8')
pattern1 = re.compile(r'// ═+\r?\n// ─── IA / CHAT ─+\r?\n// ═+\r?\n.*?// ═+\r?\n// ─── FUTEBOL & ESPORTES ─+\r?\n// ═+\r?\n', re.S)
text, n1 = pattern1.subn(
    '// ═══════════════════════════════════════════════════════════════\n'
    '// ─── FUTEBOL & ESPORTES ──────────────────────────────────────\n'
    '// ═══════════════════════════════════════════════════════════════\n',
    text
)
pattern2 = re.compile(r'// ═+\r?\n// ─── FUTEBOL & ESPORTES ─+\r?\n// ═+\r?\n.*?// ═+\r?\n// ─── MODULE\.EXPORTS ─+\r?\n// ═+\r?\n', re.S)
text, n2 = pattern2.subn(
    '// ═══════════════════════════════════════════════════════════════\n'
    '// ─── MODULE.EXPORTS ──────────────────────────────────────────\n'
    '// ═══════════════════════════════════════════════════════════════\n',
    text
)
print('removed', n1, 'IA blocks,', n2, 'sports blocks')
p.write_text(text, encoding='utf8')
