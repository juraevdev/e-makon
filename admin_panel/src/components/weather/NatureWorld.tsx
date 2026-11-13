"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WeatherMood } from "@/lib/nav";
import { useLocale } from "@/providers/LocaleProvider";
import { AUTUMN_LEAF_SPRITES } from "@/lib/weather/assets";
import { blendWithLiveMood, getDailyScene } from "@/lib/weather/dailyScene";
import { getSkyBody } from "@/lib/weather/skyClock";

type Props = {
  mood: WeatherMood;
  windKmh?: number;
  className?: string;
};

type Leaf = {
  id: number;
  x: number;
  size: number;
  rot: number;
  src: string;
  duration: number;
};

type GroundLeaf = {
  id: number;
  x: number;
  y: number;
  size: number;
  rot: number;
  src: string;
};

type Drop = {
  id: number;
  x: number;
  delay: number;
  dur: number;
  size: number;
  drift: number;
};

const STORAGE_GROWTH = "emakon-nature-growth";
const LEAF_COMPOST_AT = 80;
let idSeq = 1;

function loadGrowth() {
  if (typeof window === "undefined") return 0.22;
  const v = Number(localStorage.getItem(STORAGE_GROWTH));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.22;
}

export function NatureWorld({ mood, windKmh = 0, className = "" }: Props) {
  const { t } = useLocale();

  const scene = useMemo(
    () => blendWithLiveMood(getDailyScene(), mood),
    [mood],
  );

  const [sky, setSky] = useState(() => getSkyBody());
  const [falling, setFalling] = useState<Leaf[]>([]);
  const [ground, setGround] = useState<GroundLeaf[]>([]);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [growth, setGrowth] = useState(0.22);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mountdan keyin brauzer holatini sinxronlash (SSR hydration uchun ataylab)
    setGrowth(loadGrowth());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_GROWTH, String(growth));
  }, [growth]);

  useEffect(() => {
    const tick = () => setSky(getSkyBody());
    tick();
    const tmr = window.setInterval(tick, 30_000);
    return () => clearInterval(tmr);
  }, []);

  // Barglar — faqat kuz (+ scene.leaves), shaffof SVG
  useEffect(() => {
    if (!scene.leaves) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mountdan keyin brauzer holatini sinxronlash (SSR hydration uchun ataylab)
      setFalling([]);
      return;
    }
    const wind = Math.max(scene.wind, windKmh / 50);
    const ms = Math.max(900, 1800 - wind * 400);
    const timer = window.setInterval(() => {
      const id = idSeq++;
      const src =
        AUTUMN_LEAF_SPRITES[Math.floor(Math.random() * AUTUMN_LEAF_SPRITES.length)]!;
      const duration = 7 + Math.random() * 5;
      const leaf: Leaf = {
        id,
        x: Math.random() * 96 + 2,
        size: 22 + Math.random() * 20,
        rot: Math.random() * 360,
        src,
        duration,
      };
      setFalling((p) => [...p.slice(-20), leaf]);
      window.setTimeout(() => {
        setFalling((p) => p.filter((l) => l.id !== id));
        setGround((p) =>
          [
            ...p,
            {
              id,
              x: leaf.x + (Math.random() - 0.5) * 4,
              y: 4 + Math.random() * 22,
              size: leaf.size,
              rot: leaf.rot,
              src: leaf.src,
            },
          ].slice(-100),
        );
      }, duration * 1000);
    }, ms);
    return () => clearInterval(timer);
  }, [scene.leaves, scene.wind, windKmh]);

  useEffect(() => {
    if (ground.length < LEAF_COMPOST_AT) return;
    const tmr = window.setTimeout(() => {
      setGround([]);
      setGrowth((g) => Math.min(1, g + 0.12));
    }, 1400);
    return () => clearTimeout(tmr);
  }, [ground.length]);

  useEffect(() => {
    if (!scene.rain) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mountdan keyin brauzer holatini sinxronlash (SSR hydration uchun ataylab)
      setDrops([]);
      return;
    }
    const makeDrops = (): Drop[] =>
      Array.from({ length: 64 }, () => ({
        id: idSeq++,
        x: Math.random() * 100,
        delay: Math.random() * 2.2,
        dur: 0.45 + Math.random() * 0.7,
        size: 14 + Math.random() * 28,
        drift: -4 + Math.random() * 14,
      }));
    setDrops(makeDrops());
    const dropTmr = window.setInterval(() => setDrops(makeDrops()), 5200);
    return () => clearInterval(dropTmr);
  }, [scene.rain]);

  useEffect(() => {
    const tmr = window.setInterval(() => {
      setGrowth((g) =>
        Math.min(1, g + (scene.rain || scene.dew ? 0.003 : 0.0015)),
      );
    }, 10_000);
    return () => clearInterval(tmr);
  }, [scene.rain, scene.dew]);

  const clearLeaves = useCallback(() => setGround([]), []);

  const plantHeight = `${10 + growth * 38}%`;

  return (
    <div
      className={`weather-fx nature-world ${className}`}
      data-season={scene.season}
      data-mood={mood}
    >
      {/* Fasl fon — sabit, silkamaydi */}
      <div
        className="nw-photo"
        style={{ backgroundImage: `url(${scene.photo})` }}
        aria-hidden
      />
      <div className="nw-photo-veil" aria-hidden />

      {/* Yengil osmon urg‘usi */}
      <div
        className={`nw-sky-tint${sky.isNight ? " is-night" : ""}${sky.isDusk || sky.isDawn ? " is-dusk" : ""}`}
        aria-hidden
      />

      {scene.mist ? <div className="nw-mist" aria-hidden /> : null}
      {scene.snow ? <div className="nw-snow" aria-hidden /> : null}
      {scene.dew ? <div className="nw-dew-sparkle" aria-hidden /> : null}

      {scene.rain ? (
        <div className="nw-glass-rain" aria-hidden>
          <div className="nw-rain-veil" />
          <div className="nw-rain-mist" />
          <div className="nw-glass-sheen" />
          {drops.map((d) => (
            <span
              key={d.id}
              className="nw-rain-streak"
              style={{
                left: `${d.x}%`,
                height: `${d.size}px`,
                animationDelay: `${d.delay}s`,
                animationDuration: `${d.dur}s`,
                ["--drift" as string]: `${d.drift}px`,
              }}
            />
          ))}
          <div className="nw-rain-wet" />
        </div>
      ) : null}

      {/* Kuzgi shaffof SVG barglar */}
      {scene.leaves ? (
        <div className="nw-sky-particles" aria-hidden>
          {falling.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={l.id}
              src={l.src}
              alt=""
              className="nw-fall-leaf"
              style={{
                left: `${l.x}%`,
                width: l.size,
                height: l.size,
                animationDuration: `${l.duration}s`,
                ["--spin" as string]: `${l.rot}deg`,
                ["--wind" as string]: `${16 + scene.wind * 28}px`,
              }}
            />
          ))}
        </div>
      ) : null}

      {/* Pastki realistik o‘simliklar */}
      <div className="nw-flora" style={{ height: plantHeight }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={scene.floraPhoto}
          alt=""
          className="nw-flora-img"
          draggable={false}
        />
      </div>

      {scene.leaves && ground.length > 0 ? (
        <div
          className={`nw-ground-leaves${ground.length >= LEAF_COMPOST_AT ? " composting" : ""}`}
          onPointerDown={clearLeaves}
          role="presentation"
        >
          {ground.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={l.id}
              src={l.src}
              alt=""
              className="nw-ground-leaf"
              style={{
                left: `${l.x}%`,
                bottom: `${l.y}%`,
                width: l.size,
                height: l.size,
                transform: `rotate(${l.rot}deg)`,
              }}
            />
          ))}
          {ground.length >= LEAF_COMPOST_AT ? (
            <p className="nw-compost-msg">{t("nature.composting")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
