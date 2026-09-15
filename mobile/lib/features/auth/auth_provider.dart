import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/network/api_client.dart';
import '../../core/network/models.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider(this._api);

  final ApiClient _api;

  UserModel? user;
  bool bootstrapping = true;
  bool loading = false;
  String? error;
  bool onboardingDone = false;

  Future<void> bootstrap() async {
    bootstrapping = true;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    onboardingDone = prefs.getBool('onboarding_done') ?? false;
    if (await _api.hasToken) {
      try {
        final data = await _api.get('/auth/me/');
        user = UserModel.fromJson(Map<String, dynamic>.from(data as Map));
      } catch (_) {
        await _api.clearTokens();
        user = null;
      }
    }
    bootstrapping = false;
    notifyListeners();
  }

  Future<void> completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_done', true);
    onboardingDone = true;
    notifyListeners();
  }

  Future<Map<String, dynamic>> requestOtp(String phoneDigits) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final data = await _api.post(
        '/auth/otp/request/',
        auth: false,
        body: {'phone': phoneDigits, 'purpose': 'login'},
      );
      return Map<String, dynamic>.from(data as Map);
    } on ApiException catch (e) {
      error = e.message;
      rethrow;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> verifyOtp({
    required String phoneDigits,
    required String code,
    String fullName = '',
  }) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final data = await _api.post(
        '/auth/otp/verify/',
        auth: false,
        body: {
          'phone': phoneDigits,
          'code': code,
          'purpose': 'login',
          if (fullName.isNotEmpty) 'full_name': fullName,
        },
      );
      final map = Map<String, dynamic>.from(data as Map);
      await _api.saveTokens(
        access: map['access'] as String,
        refresh: map['refresh'] as String,
      );
      user = UserModel.fromJson(Map<String, dynamic>.from(map['user'] as Map));
    } on ApiException catch (e) {
      error = e.message;
      rethrow;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> updateProfile({
    String? fullName,
    String? firstName,
    String? lastName,
    String? birthDate,
    String? homeAddress,
    String? country,
    String? region,
    String? district,
    String? street,
    double? locationLat,
    double? locationLng,
    List<String>? additionalPhones,
  }) async {
    final data = await _api.patch('/auth/me/', body: {
      if (fullName != null) 'full_name': fullName,
      if (firstName != null) 'first_name': firstName,
      if (lastName != null) 'last_name': lastName,
      if (birthDate != null) 'birth_date': birthDate,
      if (homeAddress != null) 'home_address': homeAddress,
      if (country != null) 'country': country,
      if (region != null) 'region': region,
      if (district != null) 'district': district,
      if (street != null) 'street': street,
      if (locationLat != null) 'location_lat': locationLat,
      if (locationLng != null) 'location_lng': locationLng,
      if (additionalPhones != null) 'additional_phones': additionalPhones,
    });
    user = UserModel.fromJson(Map<String, dynamic>.from(data as Map));
    notifyListeners();
  }

  Future<void> logout() async {
    await _api.clearTokens();
    user = null;
    notifyListeners();
  }

  bool get isLoggedIn => user != null;
}
