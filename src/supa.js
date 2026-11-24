/**
 * @template T
 * @param {number} length
 * @param {T} value
 *
 * @return {T[]}
 */
export function $array(length, value) {
  return Array(length).fill(value);
}

export function $lerp(length, min, max) {
  return Array(length)
    .fill(min)
    .map((x, i) => x + i * ((max - min) / (length - 1)));
}
