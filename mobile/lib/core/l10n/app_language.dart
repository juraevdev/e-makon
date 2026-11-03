import 'package:flutter/material.dart';

enum AppLanguage {
  en,
  ru,
  uzLatn,
  uzCyrl;

  String get code => switch (this) {
        AppLanguage.en => 'en',
        AppLanguage.ru => 'ru',
        AppLanguage.uzLatn => 'uz_Latn',
        AppLanguage.uzCyrl => 'uz_Cyrl',
      };

  /// Sozlamalar ro‘yxatida ko‘rinadigan nom (o‘z tilida).
  String get nativeLabel => switch (this) {
        AppLanguage.en => 'English',
        AppLanguage.ru => 'Русский',
        AppLanguage.uzLatn => "O‘zbekcha",
        AppLanguage.uzCyrl => 'Ўзбекча',
      };

  Locale get locale => switch (this) {
        AppLanguage.en => const Locale('en'),
        AppLanguage.ru => const Locale('ru'),
        AppLanguage.uzLatn => const Locale.fromSubtags(languageCode: 'uz', scriptCode: 'Latn'),
        AppLanguage.uzCyrl => const Locale.fromSubtags(languageCode: 'uz', scriptCode: 'Cyrl'),
      };

  /// intl DateFormat / NumberFormat uchun.
  String get intlTag => switch (this) {
        AppLanguage.en => 'en',
        AppLanguage.ru => 'ru',
        AppLanguage.uzLatn => 'uz',
        AppLanguage.uzCyrl => 'uz',
      };

  static AppLanguage? fromCode(String? code) {
    if (code == null) return null;
    for (final lang in AppLanguage.values) {
      if (lang.code == code) return lang;
    }
    return null;
  }

  static const supported = AppLanguage.values;
}
