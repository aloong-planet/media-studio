// The problems pnpm stills reports, each with the still it was seen in. A problem in the diagram shows in every frame:
// it is reported once, with where it was first seen. Each cover lays out the main visual for its own ratio: a problem
// is reported for every cover it is on.
export const problemList = () => {
  const found = new Map();
  return {
    add: (text, shot) => {
      const key = shot.cover ? `${shot.output}\n${text}` : text;
      if (!found.has(key)) found.set(key, `${shot.output}: ${text}`);
    },
    lines: () => [...found.values()],
  };
};
