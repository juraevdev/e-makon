"use client";

import type { WeatherMood } from "@/lib/nav";
import { NatureWorld } from "./NatureWorld";

type Props = {
  mood: WeatherMood;
  windKmh?: number;
  className?: string;
};

/** Asosiy tabiat sahna — kunlik manzara, quyosh/oy, yomg‘ir oynasi, o‘sish. */
export function WeatherEffects({ mood, windKmh = 0, className = "" }: Props) {
  return <NatureWorld mood={mood} windKmh={windKmh} className={className} />;
}
