class ApiConfig {
  /// false — real API. Demo uchun: --dart-define=USE_LOCAL_DATA=true
  static const bool useLocalData = bool.fromEnvironment(
    'USE_LOCAL_DATA',
    defaultValue: false,
  );

  /// Emulator (Android): http://10.0.2.2:8000/api/v1
  /// Real telefon: PC LAN IP (masalan http://192.168.0.117:8000/api/v1)
  /// Windows / iOS simulator: http://127.0.0.1:8000/api/v1
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.0.117:8000/api/v1',
  );

  static const Duration requestTimeout = Duration(seconds: 12);

  /// Server `/media/...` kabi nisbiy yo'l qaytarsa — API hostiga bog'laydi.
  static String mediaUrl(String path) {
    if (path.isEmpty || path.startsWith('http://') || path.startsWith('https://')) return path;
    if (!path.startsWith('/')) return path;
    final base = Uri.tryParse(baseUrl);
    if (base == null || base.host.isEmpty) return path;
    return base.replace(path: path).toString();
  }

  static const String brandName = 'e-makon';
  static const String tagline = "Makoningiz go'zalligi — bizning ishimiz";
}
