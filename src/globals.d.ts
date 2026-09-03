// `console` exists in every runtime this package targets (browser, Node, Web
// Worker) but is not part of the ES2022 library. Declared minimally rather than
// adding "DOM" to `lib`, which would defeat the compile-time guard that keeps
// this package Worker-safe by making `document`/`window` a type error.
declare const console: {
  warn(...data: readonly unknown[]): void;
  log(...data: readonly unknown[]): void;
};
