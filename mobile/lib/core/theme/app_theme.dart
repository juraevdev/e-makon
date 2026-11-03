import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  AppTheme._();

  static SystemUiOverlayStyle overlayFor(Brightness brightness) {
    final lightIcons = brightness == Brightness.dark;
    return SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: lightIcons ? Brightness.light : Brightness.dark,
      statusBarBrightness: lightIcons ? Brightness.dark : Brightness.light,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
      systemNavigationBarIconBrightness: lightIcons ? Brightness.light : Brightness.dark,
      systemNavigationBarContrastEnforced: true,
    );
  }

  /// Edge-to-edge default (dark). Prefer [overlayFor] at runtime.
  static final systemOverlay = overlayFor(Brightness.dark);

  static ThemeData? _dark;
  static ThemeData? _light;

  static ThemeData get dark => _dark ??= _build(Brightness.dark);
  static ThemeData get light => _light ??= _build(Brightness.light);

  static ThemeData _build(Brightness brightness) {
    final jakarta = GoogleFonts.plusJakartaSansTextTheme();
    final work = GoogleFonts.workSansTextTheme();
    final isDark = brightness == Brightness.dark;
    final scheme = isDark
        ? const ColorScheme.dark(
            surface: Color(0xFF121414),
            primary: Color(0xFF88D982),
            onPrimary: Color(0xFF003909),
            primaryContainer: Color(0xFF2E7D32),
            onPrimaryContainer: Color(0xFFCBFFC2),
            secondary: Color(0xFF83DA85),
            tertiary: Color(0xFFA2D3A4),
            error: Color(0xFFFFB4AB),
            onSurface: Color(0xFFE2E2E2),
            onSurfaceVariant: Color(0xFFBFCABA),
            outline: Color(0xFF8A9485),
            outlineVariant: Color(0xFF40493D),
          )
        : const ColorScheme.light(
            surface: Color(0xFFF8FAF6),
            primary: Color(0xFF176B28),
            onPrimary: Color(0xFFFFFFFF),
            primaryContainer: Color(0xFFB8F0B4),
            onPrimaryContainer: Color(0xFF003909),
            secondary: Color(0xFF2E7D32),
            tertiary: Color(0xFF4B7850),
            error: Color(0xFFBA1A1A),
            onSurface: Color(0xFF121512),
            onSurfaceVariant: Color(0xFF4E564C),
            outline: Color(0xFF6F776C),
            outlineVariant: Color(0xFFC2C9BC),
          );

    // Restore after ColorScheme const construction used fixed colors above —
    // AppColors getters must match this ThemeData brightness when widgets build.
    final bg = isDark ? const Color(0xFF121414) : const Color(0xFFF3F6F1);
    final surfaceContainer = isDark ? const Color(0xFF1E2020) : const Color(0xFFE8EEE4);
    final secondaryContainer = isDark ? const Color(0xFF00631E) : const Color(0xFFC8E6C9);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: bg,
      colorScheme: scheme,
      textTheme: jakarta.copyWith(
        displayLarge: jakarta.displayLarge?.copyWith(
          fontSize: isDark ? 48 : 46,
          fontWeight: FontWeight.w800,
          height: isDark ? 56 / 48 : 1.12,
          letterSpacing: isDark ? -0.02 * 48 : -0.8,
          color: scheme.onSurface,
        ),
        headlineLarge: jakarta.headlineLarge?.copyWith(
          fontSize: 28,
          fontWeight: isDark ? FontWeight.w700 : FontWeight.w800,
          height: 36 / 28,
          letterSpacing: isDark ? 0 : -0.3,
          color: scheme.onSurface,
        ),
        headlineMedium: jakarta.headlineMedium?.copyWith(
          fontSize: 24,
          fontWeight: isDark ? FontWeight.w600 : FontWeight.w700,
          height: 32 / 24,
          letterSpacing: isDark ? 0 : -0.2,
          color: scheme.onSurface,
        ),
        titleMedium: jakarta.titleMedium?.copyWith(
          fontSize: 16,
          fontWeight: isDark ? FontWeight.w600 : FontWeight.w700,
          color: scheme.onSurface,
        ),
        bodyLarge: work.bodyLarge?.copyWith(
          fontSize: 18,
          fontWeight: FontWeight.w400,
          height: isDark ? 28 / 18 : 1.5,
          color: scheme.onSurface,
        ),
        bodyMedium: work.bodyMedium?.copyWith(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          height: isDark ? 24 / 16 : 1.45,
          color: scheme.onSurface,
        ),
        labelLarge: work.labelLarge?.copyWith(
          fontSize: 14,
          fontWeight: isDark ? FontWeight.w600 : FontWeight.w700,
          letterSpacing: isDark ? 0.14 : 0.05,
          color: scheme.onSurface,
        ),
        labelSmall: work.labelSmall?.copyWith(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          letterSpacing: isDark ? 0.6 : 0.2,
          color: scheme.onSurfaceVariant,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: bg.withValues(alpha: isDark ? 0.15 : 0.85),
        elevation: 0,
        scrolledUnderElevation: 0,
        systemOverlayStyle: overlayFor(brightness),
        titleTextStyle: GoogleFonts.plusJakartaSans(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ),
        iconTheme: IconThemeData(color: scheme.onSurface),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: scheme.outlineVariant, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: scheme.outlineVariant, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: scheme.primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: TextStyle(color: scheme.onSurfaceVariant.withValues(alpha: 0.55)),
        labelStyle: TextStyle(color: scheme.onSurfaceVariant),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          elevation: 0,
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: GoogleFonts.workSans(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: scheme.primaryContainer,
          foregroundColor: scheme.onPrimaryContainer,
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surfaceContainer.withValues(alpha: 0.85),
        indicatorColor: secondaryContainer.withValues(alpha: 0.35),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.workSans(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: selected ? scheme.secondary : scheme.onSurfaceVariant.withValues(alpha: 0.7),
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? scheme.secondary : scheme.onSurfaceVariant.withValues(alpha: 0.7),
          );
        }),
      ),
    );
  }
}
