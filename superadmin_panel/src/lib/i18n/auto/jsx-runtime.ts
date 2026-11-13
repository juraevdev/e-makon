/* Maxsus JSX runtime (tsconfig: jsxImportSource) — React'nikini o'rab, matnlarni tarjima qiladi. */
import * as R from "react/jsx-runtime";
import { patchProps } from "./patch";

export type { JSX } from "react/jsx-runtime";
export const Fragment = R.Fragment;

type Fn = (type: unknown, props: unknown, key?: unknown) => unknown;

export const jsx = ((type: unknown, props: Record<string, unknown>, key?: unknown) =>
  (R.jsx as Fn)(type, patchProps(type, props), key)) as typeof R.jsx;

export const jsxs = ((type: unknown, props: Record<string, unknown>, key?: unknown) =>
  (R.jsxs as Fn)(type, patchProps(type, props), key)) as typeof R.jsxs;
