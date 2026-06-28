let _cache: Promise<typeof import('xlsx')> | null = null;
/** Cached dynamic import — resolves the same promise on repeated calls. */
export const loadXlsx = () => {
  _cache ??= import('xlsx');
  return _cache;
};
