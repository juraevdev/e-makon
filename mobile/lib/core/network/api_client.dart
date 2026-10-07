import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../constants/api_config.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({http.Client? client, FlutterSecureStorage? storage})
      : _client = client ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage();

  final http.Client _client;
  final FlutterSecureStorage _storage;

  static const _accessKey = 'access_token';
  static const _refreshKey = 'refresh_token';

  /// Token yangilab bo'lmaganda (sessiya tugagan) chaqiriladi — AuthProvider foydalanuvchini chiqaradi.
  void Function()? onSessionExpired;

  /// true — yangilandi, false — server rad etdi (sessiya tugagan), null — tarmoq xatosi.
  Future<bool?>? _refreshing;

  Future<String?> get accessToken => _storage.read(key: _accessKey);

  Future<void> saveTokens({required String access, required String refresh}) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }

  Future<bool> get hasToken async => (await accessToken)?.isNotEmpty == true;

  Future<Map<String, String>> _headers({bool auth = true, bool json = true}) async {
    final headers = <String, String>{};
    if (json) headers['Content-Type'] = 'application/json';
    if (auth) {
      final token = await accessToken;
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = ApiConfig.baseUrl.endsWith('/')
        ? ApiConfig.baseUrl.substring(0, ApiConfig.baseUrl.length - 1)
        : ApiConfig.baseUrl;
    final p = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$base$p').replace(queryParameters: query);
  }

  /// Access token muddati tugaganda (12 soat) refresh token bilan yangisini oladi.
  Future<bool?> _refreshTokens() {
    return _refreshing ??= () async {
      try {
        final refresh = await _storage.read(key: _refreshKey);
        if (refresh == null || refresh.isEmpty || refresh == 'demo-refresh') return false;
        final res = await _client
            .post(
              _uri('/auth/token/refresh/'),
              headers: const {'Content-Type': 'application/json'},
              body: jsonEncode({'refresh': refresh}),
            )
            .timeout(ApiConfig.requestTimeout);
        if (res.statusCode == 400 || res.statusCode == 401) return false;
        if (res.statusCode != 200) return null;
        final raw = jsonDecode(res.body);
        final data = raw is Map && raw['data'] is Map ? raw['data'] as Map : raw;
        final access = data is Map ? data['access'] as String? : null;
        if (access == null || access.isEmpty) return false;
        await saveTokens(access: access, refresh: (data['refresh'] as String?) ?? refresh);
        return true;
      } catch (_) {
        return null;
      } finally {
        _refreshing = null;
      }
    }();
  }

  Future<dynamic> _guard(Future<http.Response> Function() send, {bool auth = true, Duration? timeout}) async {
    final limit = timeout ?? ApiConfig.requestTimeout;
    try {
      var res = await send().timeout(limit);
      if (res.statusCode == 401 && auth && await hasToken) {
        final refreshed = await _refreshTokens();
        if (refreshed == true) {
          res = await send().timeout(limit);
        } else if (refreshed == null) {
          throw ApiException('Serverga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring');
        } else {
          await clearTokens();
          onSessionExpired?.call();
          throw ApiException('Sessiya muddati tugadi. Iltimos, qayta kiring', statusCode: 401);
        }
      }
      return _decode(res);
    } on TimeoutException {
      throw ApiException('Server javob bermadi. Internetni tekshirib, qayta urinib ko‘ring');
    } on SocketException {
      throw ApiException('Serverga ulanib bo‘lmadi. Internet yoki API manzilini tekshiring');
    } on HttpException {
      throw ApiException('Server javob bermadi');
    } on FormatException {
      throw ApiException('Server javobi noto‘g‘ri');
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('Tarmoq xatosi: $e');
    }
  }

  Future<dynamic> get(String path, {bool auth = true, Map<String, String>? query}) async {
    return _guard(
      () async => _client.get(_uri(path, query), headers: await _headers(auth: auth)),
      auth: auth,
    );
  }

  Future<dynamic> post(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
    String? idempotencyKey,
  }) async {
    return _guard(
      () async => _client.post(
        _uri(path),
        headers: {
          ...await _headers(auth: auth),
          'Idempotency-Key': ?idempotencyKey,
        },
        body: body == null ? null : jsonEncode(body),
      ),
      auth: auth,
    );
  }

  /// Tokenni serverda bekor qiladi (blacklist) va lokal nusxani o'chiradi.
  Future<void> logout() async {
    final refresh = await _storage.read(key: _refreshKey);
    await clearTokens();
    if (refresh == null || refresh.isEmpty || refresh == 'demo-refresh') return;
    try {
      await _client
          .post(
            _uri('/auth/logout/'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'refresh': refresh}),
          )
          .timeout(const Duration(seconds: 5));
    } catch (_) {
      // Lokal tokenlar o'chirildi; server tomonda bekor qilish — best effort.
    }
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    return _guard(() async => _client.patch(
          _uri(path),
          headers: await _headers(),
          body: body == null ? null : jsonEncode(body),
        ));
  }

  /// [files] — fabrikalar: 401 dan keyin qayta yuborishda MultipartFile qaytadan yaratilishi shart
  /// (bir marta o'qilgan stream'ni qayta yuborib bo'lmaydi).
  Future<dynamic> postMultipart(
    String path, {
    required Map<String, String> fields,
    List<Future<http.MultipartFile> Function()> files = const [],
    String? idempotencyKey,
  }) async {
    return _guard(() async {
      final req = http.MultipartRequest('POST', _uri(path));
      final token = await accessToken;
      if (token != null) req.headers['Authorization'] = 'Bearer $token';
      if (idempotencyKey != null) req.headers['Idempotency-Key'] = idempotencyKey;
      req.fields.addAll(fields);
      for (final make in files) {
        req.files.add(await make());
      }
      final streamed = await _client.send(req);
      return http.Response.fromStream(streamed);
    }, timeout: const Duration(seconds: 90));
  }

  dynamic _decode(http.Response res) {
    dynamic raw;
    try {
      raw = res.body.isEmpty ? null : jsonDecode(res.body);
    } catch (_) {
      raw = null;
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (raw is Map && raw.containsKey('data')) return raw['data'];
      return raw;
    }
    String message = 'Xatolik (${res.statusCode})';
    if (raw is Map) {
      message = (raw['message'] ?? raw['detail'] ?? message).toString();
      if (raw['errors'] != null) message = '$message: ${raw['errors']}';
    }
    throw ApiException(message, statusCode: res.statusCode);
  }
}
