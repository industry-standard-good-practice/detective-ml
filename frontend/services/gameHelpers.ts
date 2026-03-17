
export const getSuspectColor = (seed: number) => {
  const colors = [
    '#500', // Red
    '#050', // Green
    '#005', // Blue
    '#550', // Yellow
    '#505', // Magenta
    '#055', // Cyan
    '#333', // Gray
    '#420', // Brown
    '#204', // Purple
    '#042'  // Teal
  ];
  return colors[seed % colors.length];
};

export const getSuspectBackingColor = (seed: number) => {
  const colors = [
    '#300', '#030', '#003', '#330', '#303', '#033', '#222', '#210', '#102', '#021'
  ];
  return colors[seed % colors.length];
};

export const getSuspectColorDescription = (seed: number) => {
  const descriptions = [
    'crimson', 'emerald', 'sapphire', 'amber', 'amethyst', 'cyan', 'slate', 'sepia', 'violet', 'teal'
  ];
  return descriptions[seed % descriptions.length];
};

export const getPixelArtUrl = (seed: number | string, type: string | number = 'human') => {
  const size = typeof type === 'number' ? `${type}/${type}` : (type === 'human' ? '400/400' : '800/600');
  return `https://picsum.photos/seed/${seed}/${size}?blur=2`;
};
