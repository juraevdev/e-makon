class ApiConfig {
  /// true — backend yo‘q; API chaqirilmaydi, lokal demo kontent.
  /// Server tayyor bo‘lganda: --dart-define=USE_LOCAL_DATA=false
  static const bool useLocalData = bool.fromEnvironment(
    'USE_LOCAL_DATA',
    defaultValue: true,
  );

  /// Emulator: 10.0.2.2 | Real telefon: PC LAN IP (masalan 192.168.0.137)
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.0.137:8000/api/v1',
  );

  static const Duration requestTimeout = Duration(seconds: 2);

  static const String brandName = 'e-makon';
  static const String tagline = "Makoningiz go'zalligi — bizning ishimiz";
}
