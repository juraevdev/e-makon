import type { Season } from "@/lib/weather/season";

/** Faqat shaffof SVG barglar (oq fon yo‘q). */
export const LEAF_SPRITES = [
  "/weather/leaf-green.svg",
  "/weather/leaf-maple.svg",
  "/weather/leaf-orange.svg",
  "/weather/leaf-yellow.svg",
  "/weather/leaf-dry.svg",
  "/weather/leaf-burgundy.svg",
] as const;

/** Kuzgi barg to‘kilishi uchun issiq ranglar. */
export const AUTUMN_LEAF_SPRITES = [
  "/weather/leaf-maple.svg",
  "/weather/leaf-orange.svg",
  "/weather/leaf-yellow.svg",
  "/weather/leaf-dry.svg",
  "/weather/leaf-burgundy.svg",
] as const;

export const SEASON_BG: Record<Season, string> = {
  spring: "/weather/bg-spring.jpg",
  summer: "/weather/bg-summer.jpg",
  autumn: "/weather/bg-autumn.jpg",
  winter: "/weather/bg-winter.jpg",
};

/** Pastki o‘simliklar — oq fon kesilgan PNG. */
export const SEASON_FLORA: Record<Season, string> = {
  spring: "/weather/flora-spring.png",
  summer: "/weather/flora-summer.png",
  autumn: "/weather/flora-autumn.png",
  winter: "/weather/flora-winter.png",
};

export const DROP_SINGLE = "/weather/drop-single.png";
export const DROPS_GLASS = "/weather/drops-glass.png";
export const FOG_CITY = "/weather/fog-city.png";
export const FOG_WOODS = "/weather/fog-woods.png";
export const MOON_REAL = "/weather/moon-real.jpg";
export const SUNSET_SUN = "/weather/sunset-sun.png";

export function leafSpritesFor(season: Season): readonly string[] {
  if (season === "autumn") return AUTUMN_LEAF_SPRITES;
  if (season === "spring") return ["/weather/leaf-green.svg", "/weather/leaf-yellow.svg"];
  return LEAF_SPRITES;
}
