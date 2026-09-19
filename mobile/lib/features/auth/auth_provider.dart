import 'dart:convert';

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
  bool demoSession = false;
  static const demoOtpCode = '123456';

  /// Ro'yxatdan o'tish vaqtida OTP oldidan saqlanadi.
  Map<String, String>? pendingRegistration;

  static const _profileKey = 'demo_user_profile';

  Future<void> bootstrap() async {
    bootstrapping = true;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    onboardingDone = prefs.getBool('onboarding_done') ?? false;
    if (await _api.hasToken) {
      try {
        final data = await _api.get('/auth/me/');
        user = UserModel.fromJson(Map<String, dynamic>.from(data as Map));
        demoSession = false;
      } catch (_) {
        final token = await _api.accessToken;
        if (token == 'demo-access') {
          user = await _loadLocalProfile() ??
              UserModel(
                id: 0,
                phone: '',
                fullName: 'Demo foydalanuvchi',
                role: 'customer',
                points: 40,
              );
          demoSession = true;
        } else {
          await _api.clearTokens();
          user = null;
        }
      }
    }
    bootstrapping = false;
    notifyListeners();
  }

  Future<UserModel?> _loadLocalProfile() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_profileKey);
    if (raw == null) return null;
    try {
      return UserModel.fromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveLocalProfile(UserModel u) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_profileKey, jsonEncode(u.toJson()));
  }

  Future<void> completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_done', true);
    onboardingDone = true;
    notifyListeners();
  }

  String normalizePhone(String phoneDigits) {
    final digits = phoneDigits.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('998') && digits.length == 12) return '+$digits';
    if (digits.length == 9) return '+998$digits';
    return phoneDigits.startsWith('+') ? phoneDigits : '+$digits';
  }

  void setPendingRegistration({
    required String firstName,
    required String lastName,
    required String company,
    required String phoneDigits,
  }) {
    pendingRegistration = {
      'first_name': firstName.trim(),
      'last_name': lastName.trim(),
      'company': company.trim(),
      'phone': phoneDigits.replaceAll(RegExp(r'\D'), ''),
    };
  }

  Future<Map<String, dynamic>> requestOtp(String phoneDigits, {String purpose = 'login'}) async {
    loading = true;
    error = null;
    notifyListeners();
    final phone = normalizePhone(phoneDigits);
    try {
      final data = await _api.post(
        '/auth/otp/request/',
        auth: false,
        body: {'phone': phone, 'purpose': purpose},
      );
      demoSession = false;
      if (data is Map) return Map<String, dynamic>.from(data);
      return <String, dynamic>{};
    } catch (e) {
      demoSession = true;
      error = null;
      if (kDebugMode) debugPrint('OTP request failed, demo mode: $e');
      return {'debug_code': demoOtpCode, 'demo': true};
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
    final phone = normalizePhone(phoneDigits);
    final reg = pendingRegistration;
    final first = reg?['first_name'] ?? '';
    final last = reg?['last_name'] ?? '';
    final company = reg?['company'] ?? '';
    final composed = fullName.isNotEmpty
        ? fullName
        : '$first $last'.trim().isNotEmpty
            ? '$first $last'.trim()
            : (company.isNotEmpty ? company : 'Foydalanuvchi');

    try {
      if (demoSession) {
        if (code != demoOtpCode) {
          throw ApiException('Kod noto‘g‘ri. Demo kod: $demoOtpCode');
        }
        await _api.saveTokens(access: 'demo-access', refresh: 'demo-refresh');
        user = UserModel(
          id: 1,
          phone: phone,
          fullName: composed,
          role: 'customer',
          firstName: first,
          lastName: last,
          company: company,
          points: 40,
          rating: 5.0,
        );
        await _saveLocalProfile(user!);
        pendingRegistration = null;
        return;
      }

      final data = await _api.post(
        '/auth/otp/verify/',
        auth: false,
        body: {
          'phone': phone,
          'code': code,
          'purpose': reg != null ? 'register' : 'login',
          'full_name': composed,
          if (first.isNotEmpty) 'first_name': first,
          if (last.isNotEmpty) 'last_name': last,
          if (company.isNotEmpty) 'company': company,
        },
      );
      final map = Map<String, dynamic>.from(data as Map);
      await _api.saveTokens(
        access: map['access'] as String,
        refresh: map['refresh'] as String,
      );
      user = UserModel.fromJson(Map<String, dynamic>.from(map['user'] as Map));
      pendingRegistration = null;
    } on ApiException catch (e) {
      error = e.message;
      rethrow;
    } catch (e) {
      error = 'Tasdiqlashda xatolik';
      throw ApiException(error!);
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> updateProfile({
    String? firstName,
    String? lastName,
    String? company,
    String? email,
    String? address,
    String? avatarPath,
    int? points,
    bool clearAvatar = false,
  }) async {
    if (user == null) return;
    final next = user!.copyWith(
      firstName: firstName,
      lastName: lastName,
      company: company,
      email: email,
      address: address,
      avatarPath: avatarPath,
      points: points,
      clearAvatar: clearAvatar,
      fullName: () {
        final f = firstName ?? user!.firstName;
        final l = lastName ?? user!.lastName;
        final n = '$f $l'.trim();
        return n.isNotEmpty ? n : user!.fullName;
      }(),
    );

    if (demoSession) {
      user = next;
      await _saveLocalProfile(user!);
      notifyListeners();
      return;
    }

    try {
      final data = await _api.patch('/auth/me/', body: {
        if (firstName != null) 'first_name': firstName,
        if (lastName != null) 'last_name': lastName,
        if (company != null) 'company': company,
        if (email != null) 'email': email,
        if (address != null) 'address': address,
        'full_name': next.fullName,
      });
      user = UserModel.fromJson(Map<String, dynamic>.from(data as Map));
    } catch (_) {
      user = next;
    }
    notifyListeners();
  }

  Future<bool> redeemBonus(int cost) async {
    if (user == null || user!.points < cost) return false;
    await updateProfile(points: user!.points - cost);
    return true;
  }

  Future<void> addPoints(int amount) async {
    if (user == null) return;
    await updateProfile(points: user!.points + amount);
  }

  Future<void> rateUser(double stars) async {
    if (user == null) return;
    final count = user!.ratingCount + 1;
    final rating = ((user!.rating * user!.ratingCount) + stars) / count;
    user = user!.copyWith(rating: rating, ratingCount: count);
    if (demoSession) await _saveLocalProfile(user!);
    notifyListeners();
  }

  Future<void> logout() async {
    await _api.clearTokens();
    user = null;
    demoSession = false;
    pendingRegistration = null;
    notifyListeners();
  }

  bool get isLoggedIn => user != null;
}
