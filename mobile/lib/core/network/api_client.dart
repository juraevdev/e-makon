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

  Future<dynamic> _guard(Future<http.Response> Function() send) async {
    try {
      final res = await send().timeout(ApiConfig.requestTimeout);
      return _decode(res);
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
    return _guard(() async => _client.get(_uri(path, query), headers: await _headers(auth: auth)));
  }

  Future<dynamic> post(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    return _guard(() async => _client.post(
          _uri(path),
          headers: await _headers(auth: auth),
          body: body == null ? null : jsonEncode(body),
        ));
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    return _guard(() async => _client.patch(
          _uri(path),
          headers: await _headers(),
          body: body == null ? null : jsonEncode(body),
        ));
  }

  Future<dynamic> postMultipart(
    String path, {
    required Map<String, String> fields,
    List<http.MultipartFile> files = const [],
  }) async {
    return _guard(() async {
      final req = http.MultipartRequest('POST', _uri(path));
      final token = await accessToken;
      if (token != null) req.headers['Authorization'] = 'Bearer $token';
      req.fields.addAll(fields);
      req.files.addAll(files);
      final streamed = await req.send();
      return http.Response.fromStream(streamed);
    });
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
