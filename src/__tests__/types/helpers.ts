/** Compile-time assertion helpers. Nothing here exists at runtime. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Fails to compile unless T is exactly `true`. */
export type Expect<T extends true> = T;

/** True when K is an optional key of T. */
export type IsOptional<T, K extends keyof T> =
  Record<never, never> extends Pick<T, K> ? true : false;
