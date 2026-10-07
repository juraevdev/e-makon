import 'package:flutter/foundation.dart';

import '../../core/constants/api_config.dart';
import '../../core/data/demo_content.dart';
import '../../core/network/api_client.dart';
import '../../core/network/models.dart';
import '../auth/auth_provider.dart';

/// Sodiqlik ballari: balans, mukofotlar (superadmin boshqaradi), tarix va almashtirish.
class LoyaltyProvider extends ChangeNotifier {
  LoyaltyProvider(this._api, this._auth);

  final ApiClient _api;
  final AuthProvider _auth;

  int balance = 0;
  int uzsPerPoint = OrderModel.uzsPerPoint;
  int minRedeemPoints = 0;
  List<LoyaltyReward> rewards = [];
  List<PointTransaction> history = [];
  bool loading = false;
  bool loaded = false;
  String? error;
  int? redeemingId;
  final List<PointTransaction> _demoHistory = [];

  bool get _isDemo => ApiConfig.useLocalData || _auth.demoSession;

  bool canRedeem(LoyaltyReward r) => redeemingId == null && balance >= r.pointsCost && balance >= minRedeemPoints;

  Future<void> load({bool silent = false}) async {
    if (_auth.user == null) return;
    if (_isDemo) {
      balance = _auth.user?.points ?? 0;
      rewards = DemoContent.bonuses.map(LoyaltyReward.fromBonus).toList();
      history = List.of(_demoHistory);
      loaded = true;
      notifyListeners();
      return;
    }
    if (!silent) {
      loading = true;
      error = null;
      notifyListeners();
    }
    try {
      final results = await Future.wait([
        _api.get('/loyalty/'),
        _api.get('/loyalty/transactions/', query: const {'page_size': '50'}),
      ]);
      final summary = LoyaltySummary.fromJson(Map<String, dynamic>.from(results[0] as Map));
      balance = summary.balance;
      uzsPerPoint = summary.uzsPerPoint;
      minRedeemPoints = summary.minRedeemPoints;
      rewards = List.of(summary.rewards)..sort((a, b) => a.pointsCost.compareTo(b.pointsCost));
      final raw = results[1];
      final list = raw is Map ? raw['results'] : raw;
      history = list is List
          ? list.whereType<Map>().map((e) => PointTransaction.fromJson(Map<String, dynamic>.from(e))).toList()
          : <PointTransaction>[];
      if (uzsPerPoint > 0) OrderModel.uzsPerPoint = uzsPerPoint;
      _auth.setPoints(balance);
      loaded = true;
      error = null;
    } catch (e) {
      if (!silent) {
        error = e is ApiException && (e.statusCode == 403)
            ? 'Ballar faqat mijoz hisobida mavjud'
            : (e is ApiException ? e.message : 'Ballarni yuklab bo‘lmadi');
      }
      if (kDebugMode) debugPrint('loyalty: $e');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Mukofotni ballga almashtiradi. Muvaffaqiyatli bo'lsa server xabarini qaytaradi.
  Future<String> redeem(LoyaltyReward reward) async {
    if (redeemingId != null) throw ApiException('Iltimos, kuting…');
    redeemingId = reward.id;
    notifyListeners();
    try {
      if (_isDemo) {
        if (balance < reward.pointsCost) throw ApiException('Ballaringiz yetarli emas.');
        balance -= reward.pointsCost;
        _demoHistory.insert(
          0,
          PointTransaction(
            id: DateTime.now().millisecondsSinceEpoch,
            kind: 'redeem',
            kindLabel: 'Almashtirildi',
            points: -reward.pointsCost,
            note: reward.name,
            createdAt: DateTime.now(),
          ),
        );
        history = List.of(_demoHistory);
        await _auth.addPoints(-reward.pointsCost);
        return 'Mukofot olindi';
      }
      final data = await _api.post('/loyalty/redeem/', body: {'reward_id': reward.id});
      final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
      balance = asInt(map['balance'], balance - reward.pointsCost);
      final tx = map['transaction'];
      if (tx is Map) history = [PointTransaction.fromJson(Map<String, dynamic>.from(tx)), ...history];
      _auth.setPoints(balance);
      return 'Mukofot olindi';
    } finally {
      redeemingId = null;
      notifyListeners();
    }
  }

  void reset() {
    balance = 0;
    rewards = [];
    history = [];
    loaded = false;
    error = null;
    _demoHistory.clear();
    notifyListeners();
  }
}
