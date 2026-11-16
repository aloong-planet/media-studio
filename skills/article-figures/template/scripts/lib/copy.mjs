// Decides how approved figures enter the article's images folder without losing what is already there.
// figures: [{name, sha256}]; folder: {entries, ignoreCase}, where entries maps every name in the folder to the sha256 of
// its content, or to null when it is no plain file (a link, a folder), and ignoreCase tells whether the folder takes
// Cover.png and cover.png for one name, as macOS volumes do unless they were made case-sensitive.
// An entry under a figure's name that is not the same file is renamed to <its stem>-v<n><ext>, n the smallest number
// whose name is free among the folder's entries and the figures' own names; the same file is left as it is.
export function planCopy(figures, {entries, ignoreCase}) {
  const key = (name) => (ignoreCase ? name.toLowerCase() : name);
  const present = new Map([...entries].map(([name, sha256]) => [key(name), {name, sha256}]));
  const taken = new Set([...entries.keys(), ...figures.map((f) => f.name)].map(key));
  return figures.map(({name, sha256}) => {
    const old = present.get(key(name));
    if (!old) return {name, action: 'copy'};
    if (old.sha256 === sha256) return {name, action: 'keep'};
    const dot = old.name.lastIndexOf('.');
    const [stem, ext] = dot > 0 ? [old.name.slice(0, dot), old.name.slice(dot)] : [old.name, ''];
    let n = 1;
    while (taken.has(key(`${stem}-v${n}${ext}`))) n++;
    const to = `${stem}-v${n}${ext}`;
    taken.add(key(to));
    return {name, action: 'copy', rename: {from: old.name, to}};
  });
}

// Carries out the plan with ops: rename(from, to), and copy(name), which never replaces an entry and throws when it
// cannot copy. An older entry is renamed out of the way first; when the copy then fails it is renamed back and the
// error is thrown, so the folder keeps every entry it had, the figures copied before stay, and none after is tried.
export function applyPlan(plan, ops) {
  for (const p of plan) {
    if (p.action !== 'copy') continue;
    if (p.rename) ops.rename(p.rename.from, p.rename.to);
    try {
      ops.copy(p.name);
    } catch (error) {
      if (p.rename) ops.rename(p.rename.to, p.rename.from);
      throw error;
    }
  }
}
