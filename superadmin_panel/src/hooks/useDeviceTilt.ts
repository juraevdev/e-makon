"use client";

/** Silkash o‘chirilgan — foydalanuvchi so‘rovi bo‘yicha. */
export type Tilt = { x: number; y: number };

export function useDeviceTilt(_enabled = true): Tilt {
  return { x: 0, y: 0 };
}
