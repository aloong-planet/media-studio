// Decides how approved figures enter the article's images folder without losing a file that is already there.
// figures: [{name, sha256}]; existing: Map of every file name in the folder to its sha256.
// Names are compared without regard to letter case, since macOS folders treat Cover.png and cover.png as one file.
// A different file under a figure's name is renamed to <its stem>-v<n><ext>, n the smallest number whose name is free
// among the folder's files and the figures' own names; a file with the same content is left as it is.
export function planCopy(figures, existing) {
  const key = (name) => name.toLowerCase();
  const present = new Map([...existing].map(([name, sha256]) => [key(name), {name, sha256}]));
  const taken = new Set([...existing.keys(), ...figures.map((f) => f.name)].map(key));
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
