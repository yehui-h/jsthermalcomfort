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

export function $max(array, sentinel) {
  return array.map((array) => (array < sentinel ? sentinel : array));
}

export function $min(array, sentinel) {
  return array.map((array) => (array > sentinel ? sentinel : array));
}

export function $index(array, indicies) {
  return array.filter((_, i) => indicies.includes(i));
}
