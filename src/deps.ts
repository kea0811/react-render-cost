/** The I/O the CLI depends on. The binary wires these to the real process. */
export interface RunDeps {
  /** Print a line to stdout. */
  log: (message: string) => void;
  /** Print a line to stderr. */
  error: (message: string) => void;
  /** Read a file synchronously; the binary maps `-` to stdin. */
  readFile: (path: string) => string;
  /** Environment variables (only `NO_COLOR` is consulted). */
  env: Record<string, string | undefined>;
}
