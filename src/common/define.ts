interface MaySuccess<T> {
  value: T;
  error: null;
}

interface MayError<T, E> {
  value: T;
  error: E;
}

export type MayBe<T, E> = MaySuccess<T> | MayError<T, E>;
