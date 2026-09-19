import 'package:flutter/material.dart';

enum AppSeason { spring, summer, autumn, winter }

/// Hozirgi fasl (O‘zbekiston: bahor 3–5, yoz 6–8, kuz 9–11, qish 12–2).
class SeasonTheme {
  const SeasonTheme._({
    required this.season,
    required this.title,
    required this.subtitle,
    required this.emoji,
    required this.accent,
    required this.accentSoft,
    required this.glowA,
    required this.glowB,
    required this.glowC,
    required this.particleColors,
  });

  final AppSeason season;
  final String title;
  final String subtitle;
  final String emoji;
  final Color accent;
  final Color accentSoft;
  final Color glowA;
  final Color glowB;
  final Color glowC;
  final List<Color> particleColors;

  static SeasonTheme of([DateTime? now]) {
    final m = (now ?? DateTime.now()).month;
    if (m >= 3 && m <= 5) return spring;
    if (m >= 6 && m <= 8) return summer;
    if (m >= 9 && m <= 11) return autumn;
    return winter;
  }

  static const spring = SeasonTheme._(
    season: AppSeason.spring,
    title: 'Bahor',
    subtitle: 'Gullar ochilmoqda',
    emoji: '🌸',
    accent: Color(0xFFF48FB1),
    accentSoft: Color(0xFFCE93D8),
    glowA: Color(0x66F48FB1),
    glowB: Color(0x552E7D32),
    glowC: Color(0x4481C784),
    particleColors: [
      Color(0xFFF8BBD0),
      Color(0xFFF48FB1),
      Color(0xFFE1BEE7),
      Color(0xFFFFCDD2),
      Color(0xFFA5D6A7),
    ],
  );

  static const summer = SeasonTheme._(
    season: AppSeason.summer,
    title: 'Yoz',
    subtitle: 'Mevalar pishmoqda',
    emoji: '🍑',
    accent: Color(0xFFFFB74D),
    accentSoft: Color(0xFFFF8A65),
    glowA: Color(0x66FFB74D),
    glowB: Color(0x55FF7043),
    glowC: Color(0x444FC3F7),
    particleColors: [
      Color(0xFFFFCC80),
      Color(0xFFFF8A65),
      Color(0xFFE57373),
      Color(0xFFFFF176),
      Color(0xFF81C784),
    ],
  );

  static const autumn = SeasonTheme._(
    season: AppSeason.autumn,
    title: 'Kuz',
    subtitle: 'Barglar to‘kilmoqda',
    emoji: '🍂',
    accent: Color(0xFFFFB74D),
    accentSoft: Color(0xFFD4A017),
    glowA: Color(0x66FF9800),
    glowB: Color(0x55D84315),
    glowC: Color(0x44FFCA28),
    particleColors: [
      Color(0xFFFFB74D),
      Color(0xFFE65100),
      Color(0xFFFFCA28),
      Color(0xFFBF360C),
      Color(0xFFD4A017),
    ],
  );

  static const winter = SeasonTheme._(
    season: AppSeason.winter,
    title: 'Qish',
    subtitle: 'Qor yog‘moqda',
    emoji: '❄️',
    accent: Color(0xFF90CAF9),
    accentSoft: Color(0xFFE3F2FD),
    glowA: Color(0x5590CAF9),
    glowB: Color(0x44B3E5FC),
    glowC: Color(0x3388D982),
    particleColors: [
      Color(0xFFFFFFFF),
      Color(0xFFE3F2FD),
      Color(0xFFBBDEFB),
      Color(0xFFB3E5FC),
    ],
  );
}
