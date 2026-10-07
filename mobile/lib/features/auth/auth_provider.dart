import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants/api_config.dart';
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
    // Avvalgi versiyalardagi soxta (demo) sessiya bilan buyurtmalar serverga yetmaydi — qayta kirish kerak.
    if (!ApiConfig.useLocalData && await _api.accessToken == 'demo-access') {
      await _api.clearTokens();
    }
    if (await _api.hasToken) {
      try {
        final data = await _api.get('/auth/me/');
        user = await _withLocalExtras(UserModel.fromJson(Map<String, dynamic>.from(data as Map)));
        demoSession = false;
      } on ApiException catch (e) {
        // Faqat server sessiyani rad etsa (401/403) chiqaramiz; tarmoq yoki 5xx xatosida sessiya saqlanadi.
        final rejected = e.statusCode == 401 || e.statusCode == 403;
        if (!rejected && await _api.hasToken) {
          user = await _loadLocalProfile() ??
              UserModel(id: 0, phone: '', fullName: 'Foydalanuvchi', role: 'customer');
        } else {
          await _api.clearTokens();
          user = null;
        }
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

  /// Serverda `company` maydoni yo'q — u faqat telefonda saqlanadi.
  Future<UserModel> _withLocalExtras(UserModel server) async {
    final local = await _loadLocalProfile();
    final merged = local != null && local.id == server.id && server.company.isEmpty && local.company.isNotEmpty
        ? server.copyWith(company: local.company)
        : server;
    await _saveLocalProfile(merged);
    return merged;
  }

  /// Profilni serverdan qayta oladi (ballar firma/superadmin tomonidan o'zgarishi mumkin).
  Future<void> refreshMe() async {
    if (user == null || demoSession || ApiConfig.useLocalData) return;
    try {
      final data = await _api.get('/auth/me/');
      final fresh = await _withLocalExtras(UserModel.fromJson(Map<String, dynamic>.from(data as Map)));
      if (user == null) return;
      user = fresh;
      notifyListeners();
    } catch (e) {
      if (kDebugMode) debugPrint('me refresh: $e');
    }
  }

  /// `/loyalty/` yoki almashtirishdan kelgan haqiqiy balans.
  void setPoints(int points) {
    if (user == null || user!.points == points) return;
    user = user!.copyWith(points: points);
    notifyListeners();
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
      if (!ApiConfig.useLocalData) {
        // Demo sessiyada buyurtmalar firmaga bormaydi — xatoni ko'rsatamiz.
        error = e is ApiException ? e.message : 'Serverga ulanib bo‘lmadi';
        rethrow;
      }
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
      var signedIn = UserModel.fromJson(Map<String, dynamic>.from(map['user'] as Map));
      if (company.isNotEmpty && signedIn.company.isEmpty) signedIn = signedIn.copyWith(company: company);
      user = await _withLocalExtras(signedIn);
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

  /// Profilni serverda saqlaydi. Xato bo'lsa [ApiException] tashlanadi — ekran xabarni ko'rsatadi.
  Future<void> updateProfile({
    String? firstName,
    String? lastName,
    String? company,
    String? email,
    String? address,
    String? avatarPath,
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
      clearAvatar: clearAvatar,
      fullName: () {
        final f = firstName ?? user!.firstName;
        final l = lastName ?? user!.lastName;
        final n = '$f $l'.trim();
        return n.isNotEmpty ? n : user!.fullName;
      }(),
    );

    final onlyLocal = firstName == null && lastName == null && email == null && address == null;
    if (demoSession || onlyLocal) {
      user = next;
      await _saveLocalProfile(user!);
      notifyListeners();
      return;
    }

    final data = await _api.patch('/auth/me/', body: {
      'first_name': ?firstName,
      'last_name': ?lastName,
      'email': ?email,
      'home_address': ?address,
      'full_name': next.fullName,
    });
    user = await _withLocalExtras(
      UserModel.fromJson(Map<String, dynamic>.from(data as Map)).copyWith(company: next.company),
    );
    notifyListeners();
  }

  /// Profil rasmini serverga yuklaydi (`PATCH /auth/me/`, multipart `avatar`).
  Future<void> uploadAvatar(XFile file) async {
    if (user == null) return;
    if (demoSession || ApiConfig.useLocalData) {
      await updateProfile(avatarPath: file.path);
      return;
    }
    final bytes = await file.readAsBytes();
    final data = await _api.patchMultipart(
      '/auth/me/',
      files: () => [http.MultipartFile.fromBytes('avatar', bytes, filename: file.name)],
    );
    user = await _withLocalExtras(
      UserModel.fromJson(Map<String, dynamic>.from(data as Map)).copyWith(company: user!.company),
    );
    notifyListeners();
  }

  /// Ball buyurtma bajarilganda serverda beriladi; demo rejimida esa mahalliy qo'shiladi.
  Future<void> addPoints(int amount) async {
    if (user == null) return;
    if (demoSession || ApiConfig.useLocalData) {
      user = user!.copyWith(points: user!.points + amount);
      await _saveLocalProfile(user!);
      notifyListeners();
      return;
    }
    await refreshMe();
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
    await _api.logout();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_profileKey);
    user = null;
    demoSession = false;
    pendingRegistration = null;
    notifyListeners();
  }

  /// ApiClient tokenni yangilay olmadi — foydalanuvchi qayta kirishi kerak.
  void sessionExpired() {
    user = null;
    demoSession = false;
    error = 'Sessiya muddati tugadi. Iltimos, qayta kiring';
    notifyListeners();
  }

  bool get isLoggedIn => user != null;
}
