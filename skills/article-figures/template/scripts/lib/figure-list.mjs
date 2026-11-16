// figures.md holds the figure list the author agreed to: a Markdown table, one row per file.
const COLUMNS = {file: 'file', section: 'section', kind: 'kind', title: 'title', shows: 'shows', alt: 'alt text'};
export const EXTENSION = {still: '.png', cover: '.png', gif: '.gif'};

// Splits a table row on the pipes that are not escaped, and turns \| back into |.
const cells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));

// Returns the rows of the first table whose header names every column, or null when there is none.
export function parseFigureList(markdown) {
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) continue;
    const header = cells(lines[i]).map((c) => c.toLowerCase());
    const at = Object.fromEntries(Object.entries(COLUMNS).map(([key, name]) => [key, header.indexOf(name)]));
    if (Object.values(at).includes(-1)) continue;
    const rows = [];
    for (const line of lines.slice(i + 2)) {
      if (!line.trim().startsWith('|')) break;
      const row = cells(line);
      rows.push(Object.fromEntries(Object.entries(at).map(([key, col]) => [key, (row[col] ?? '').replace(/^`(.*)`$/, '$1')])));
    }
    return rows;
  }
  return null;
}

// figures: [{id, kind, title}] as drawn in src/data/figures.ts; a figure renders to <id> plus its kind's extension.
export function figureListProblems(rows, figures) {
  if (!rows) return ['figures.md has no table with the columns File, Section, Kind, Title, Shows and Alt text'];
  const problems = [];
  const stem = (file) => file.replace(/\.[^.]*$/, '');
  for (const row of rows) {
    const figure = figures.find((f) => f.id === stem(row.file));
    if (!figure) problems.push(`${row.file} is in figures.md but not drawn`);
    else if (row.kind !== figure.kind || row.file !== figure.id + EXTENSION[figure.kind])
      problems.push(`${row.file} is listed as ${row.kind} but drawn as ${figure.kind}, which renders ${figure.id + EXTENSION[figure.kind]}`);
    else if (row.title !== figure.title) problems.push(`${row.file} is listed as "${row.title}" but drawn as "${figure.title}"`);
  }
  for (const f of figures) if (!rows.some((row) => stem(row.file) === f.id)) problems.push(`${f.id} is drawn but not in figures.md`);
  return problems;
}
