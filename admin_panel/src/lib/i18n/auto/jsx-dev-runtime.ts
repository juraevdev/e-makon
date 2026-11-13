/* Maxsus JSX dev runtime — qarang: ./jsx-runtime.ts */
import * as R from "react/jsx-dev-runtime";
import { patchProps } from "./patch";

export type { JSX } from "react/jsx-runtime";
export const Fragment = R.Fragment;

type Fn = (...args: unknown[]) => unknown;

export const jsxDEV = ((type: unknown, props: Record<string, unknown>, ...rest: unknown[]) =>
  (R.jsxDEV as Fn)(type, patchProps(type, props), ...rest)) as typeof R.jsxDEV;
