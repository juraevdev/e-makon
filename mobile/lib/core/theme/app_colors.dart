/// Stitch design tokens — e-makon / Verdant Growth (dark + light)
library;

import 'package:flutter/material.dart';

class AppColors {
  static Brightness _brightness = Brightness.dark;

  /// MaterialApp builder ichida sync qilinadi — mavjud `AppColors.x` chaqiruvlari light/darkga moslashadi.
  static void applyBrightness(Brightness brightness) {
    _brightness = brightness;
  }

  static bool get isLight => _brightness == Brightness.light;

  // Const tokenlar (const kontekstlarga). Runtime uchun getterlarni ishlating.
  static const primaryFixed = Color(0xFF88D982);
  static const secondaryFixed = Color(0xFF83DA85);
  static const tertiaryFixed = Color(0xFFA2D3A4);
  static const errorFixed = Color(0xFFFFB4AB);
  static const onSurfaceVariantFixed = Color(0xFFBFCABA);

  static Color get background =>
      isLight ? const Color(0xFFF3F6F1) : const Color(0xFF121414);
  static Color get surface =>
      isLight ? const Color(0xFFF8FAF6) : const Color(0xFF121414);
  static Color get surfaceContainer =>
      isLight ? const Color(0xFFE8EEE4) : const Color(0xFF1E2020);
  static Color get surfaceContainerLow =>
      isLight ? const Color(0xFFEEF3EA) : const Color(0xFF1A1C1C);
  static Color get surfaceContainerHigh =>
      isLight ? const Color(0xFFDDE5D8) : const Color(0xFF282A2B);
  static Color get surfaceContainerHighest =>
      isLight ? const Color(0xFFD0DAD0) : const Color(0xFF333535);
  static Color get surfaceLowest =>
      isLight ? const Color(0xFFFFFFFF) : const Color(0xFF0C0F0F);

  static Color get primary =>
      isLight ? const Color(0xFF1B7A2C) : primaryFixed;
  static Color get primaryContainer =>
      isLight ? const Color(0xFFB8F0B4) : const Color(0xFF2E7D32);
  static Color get onPrimary =>
      isLight ? const Color(0xFFFFFFFF) : const Color(0xFF003909);
  static Color get onPrimaryContainer =>
      isLight ? const Color(0xFF003909) : const Color(0xFFCBFFC2);

  static Color get secondary =>
      isLight ? const Color(0xFF2E7D32) : secondaryFixed;
  static Color get secondaryContainer =>
      isLight ? const Color(0xFFC8E6C9) : const Color(0xFF00631E);
  static Color get onSecondaryContainer =>
      isLight ? const Color(0xFF1B5E20) : const Color(0xFF87DD88);

  static Color get tertiary =>
      isLight ? const Color(0xFF4B7850) : tertiaryFixed;
  static Color get tertiaryContainer =>
      isLight ? const Color(0xFFD4E8D5) : const Color(0xFF4B7850);

  static Color get onSurface =>
      isLight ? const Color(0xFF1A1C1A) : const Color(0xFFE2E2E2);
  static Color get onSurfaceVariant =>
      isLight ? const Color(0xFF424940) : onSurfaceVariantFixed;
  static Color get outline =>
      isLight ? const Color(0xFF72796F) : const Color(0xFF8A9485);
  static Color get outlineVariant =>
      isLight ? const Color(0xFFC2C9BC) : const Color(0xFF40493D);

  static Color get error =>
      isLight ? const Color(0xFFBA1A1A) : errorFixed;
  static const splashStart = Color(0xFF2E7D32);
  static const splashEnd = Color(0xFF66BB6A);

  static Color get glass =>
      isLight ? const Color(0xCCFFFFFF) : const Color(0x0DFFFFFF);
  static Color get glassBorder =>
      isLight ? const Color(0x332E7D32) : const Color(0x1AFFFFFF);

  static Color get navShadow =>
      isLight ? const Color(0x1A000000) : const Color(0x59000000);
}
