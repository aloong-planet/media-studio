// Decides how approved figures enter the article's images folder without losing a file that is already there.
// figures: [{name, sha256}]; existing: Map of every file name in the folder to its sha256.
// A different file under a figure's name is renamed to <stem>-v<n><ext>, n the smallest number whose name is free
// among the folder's files and the figures' own names; a file with the same content is left as it is.
export function planCopy(figures, existing) {
  const taken = new Set([...existing.keys(), ...figures.map((f) => f.name)]);
  return figures.map(({name, sha256}) => {
    if (!existing.has(name)) return {name, action: 'copy'};
    if (existing.get(name) === sha256) return {name, action: 'keep'};
    const dot = name.lastIndexOf('.');
    const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
    let n = 1;
    while (taken.has(`${stem}-v${n}${ext}`)) n++;
    const renameOldTo = `${stem}-v${n}${ext}`;
    taken.add(renameOldTo);
    return {name, action: 'copy', renameOldTo};
  });
}
