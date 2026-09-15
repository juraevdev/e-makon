class ApiConfig {
  /// Android emulator → host machine. Physical device: use LAN IP.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );

  static const String brandName = 'My Garden';
  static const String tagline = "Bog'ingiz go'zalligi — bizning ishimiz";
}
