import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../l10n/app_language.dart';
import '../l10n/app_strings.dart';

class AppSettings extends ChangeNotifier {
  AppSettings();

  static const _themeKey = 'app_theme_mode';
  static const _langKey = 'app_language';

  ThemeMode themeMode = ThemeMode.dark;
  AppLanguage language = AppLanguage.uzLatn;
  bool ready = false;

  AppStrings get strings => AppStrings.of(language);
  Locale get locale => language.locale;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final themeRaw = prefs.getString(_themeKey);
    themeMode = switch (themeRaw) {
      'light' => ThemeMode.light,
      'system' => ThemeMode.system,
      _ => ThemeMode.dark,
    };
    language = AppLanguage.fromCode(prefs.getString(_langKey)) ?? AppLanguage.uzLatn;
    ready = true;
    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    if (themeMode == mode) return;
    themeMode = mode;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _themeKey,
      switch (mode) {
        ThemeMode.light => 'light',
        ThemeMode.system => 'system',
        ThemeMode.dark => 'dark',
      },
    );
  }

  Future<void> setLanguage(AppLanguage lang) async {
    if (language == lang) return;
    language = lang;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_langKey, lang.code);
  }
}
