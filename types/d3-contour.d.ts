declare module "d3-contour" {
  export type ContourDensityAccessor<T> = (datum: T, index: number, data: T[]) => number;

  export interface ContourMultiPolygon {
    value: number;
    coordinates: number[][][][];
  }

  export interface ContourDensity<T> {
    (data: T[]): ContourMultiPolygon[];
    x(accessor: number | ContourDensityAccessor<T>): ContourDensity<T>;
    y(accessor: number | ContourDensityAccessor<T>): ContourDensity<T>;
    weight(accessor: null | number | ContourDensityAccessor<T>): ContourDensity<T>;
    size(size: readonly [number, number]): ContourDensity<T>;
    bandwidth(value: number): ContourDensity<T>;
    thresholds(count: number): ContourDensity<T>;
    thresholds(values: readonly number[]): ContourDensity<T>;
  }

  export function contourDensity<T>(): ContourDensity<T>;
}
