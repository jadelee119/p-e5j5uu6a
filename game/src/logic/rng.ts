/** mulberry32 seeded RNG */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    weighted<T>(items: T[], w: (x: T) => number): T | undefined {
      const tot = items.reduce((s, x) => s + Math.max(0, w(x)), 0);
      if (tot <= 0) return items.length ? items[Math.floor(next() * items.length)] : undefined;
      let r = next() * tot;
      for (const x of items) { r -= Math.max(0, w(x)); if (r < 0) return x; }
      return items[items.length - 1];
    },
  };
}
export type Rng = ReturnType<typeof makeRng>;
