<<<<<<< HEAD
import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Brand greens
  static const Color forestGreen = Color(0xFF1B5E3B);
  static const Color midGreen = Color(0xFF2D7A4F);
  static const Color lightGreen = Color(0xFF3D9B63);
  static const Color accentGreen = Color(0xFF4CAF50);
  static const Color mintGreen = Color(0xFFA2E4B8);
  static const Color paleGreen = Color(0xFFE8F5EC);

  // Dark theme
  static const Color darkBg = Color(0xFF121212);
  static const Color darkSurface = Color(0xFF1E1E1E);
  static const Color darkCard = Color(0xFF252525);
  static const Color darkBorder = Color(0xFF333333);
  static const Color darkMuted = Color(0xFF9E9E9E);
  static const Color darkText = Color(0xFFFFFFFF);
  static const Color darkTextSecondary = Color(0xFFB0B0B0);

  // Light theme (legacy)
  static const Color mutedText = Color(0xFF6B7C72);
  static const Color white = Color(0xFFFFFFFF);
  static const Color cardBg = Color(0xFFF7FBF8);
  static const Color border = Color(0xFFD4E8DB);
  static const Color warning = Color(0xFFE6A23C);
  static const Color error = Color(0xFFE53935);

  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [forestGreen, midGreen, lightGreen],
  );

  static const LinearGradient logoGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2E7D32), Color(0xFF4CAF50)],
  );

  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2D7A4F), Color(0xFF3D9B63)],
  );
=======
/// Stitch design tokens — My Garden / Verdant Growth
library;

import 'package:flutter/material.dart';

class AppColors {
  static const background = Color(0xFF121414);
  static const surface = Color(0xFF121414);
  static const surfaceContainer = Color(0xFF1E2020);
  static const surfaceContainerLow = Color(0xFF1A1C1C);
  static const surfaceContainerHigh = Color(0xFF282A2B);
  static const surfaceContainerHighest = Color(0xFF333535);
  static const surfaceLowest = Color(0xFF0C0F0F);

  static const primary = Color(0xFF88D982);
  static const primaryContainer = Color(0xFF2E7D32);
  static const onPrimary = Color(0xFF003909);
  static const onPrimaryContainer = Color(0xFFCBFFC2);

  static const secondary = Color(0xFF83DA85);
  static const secondaryContainer = Color(0xFF00631E);
  static const onSecondaryContainer = Color(0xFF87DD88);

  static const tertiary = Color(0xFFA2D3A4);
  static const tertiaryContainer = Color(0xFF4B7850);

  static const onSurface = Color(0xFFE2E2E2);
  static const onSurfaceVariant = Color(0xFFBFCABA);
  static const outline = Color(0xFF8A9485);
  static const outlineVariant = Color(0xFF40493D);

  static const error = Color(0xFFFFB4AB);
  static const splashStart = Color(0xFF2E7D32);
  static const splashEnd = Color(0xFF66BB6A);

  static const glass = Color(0x0DFFFFFF);
  static const glassBorder = Color(0x1AFFFFFF);
>>>>>>> 63cd8e2c5ad351605a7b5f99b986ce243e9059a8
}
