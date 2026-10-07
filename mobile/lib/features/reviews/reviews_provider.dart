import 'package:flutter/foundation.dart';

import '../../core/constants/api_config.dart';
import '../../core/network/api_client.dart';
import '../../core/network/models.dart';

/// Firma sharhlari (`/partners/{id}/reviews/`). Demo sharhlar faqat `USE_LOCAL_DATA` rejimida.
class ReviewsProvider extends ChangeNotifier {
  ReviewsProvider(this._api);

  final ApiClient _api;
  final Map<int, List<PartnerReview>> _byPartner = {};
  final Set<int> _loading = {};
  final Map<int, String> _errors = {};

  List<PartnerReview> forPartner(int partnerId) => List.unmodifiable(_byPartner[partnerId] ?? const []);

  bool isLoading(int partnerId) => _loading.contains(partnerId);

  String? errorFor(int partnerId) => _errors[partnerId];

  double average(int partnerId, {double fallback = 4.8}) {
    final list = _byPartner[partnerId];
    if (list == null || list.isEmpty) return fallback;
    return list.map((e) => e.stars).reduce((a, b) => a + b) / list.length;
  }

  Future<void> loadFor(int partnerId, {bool refresh = false}) async {
    if (_loading.contains(partnerId) || (!refresh && _byPartner.containsKey(partnerId))) return;
    if (ApiConfig.useLocalData) {
      _byPartner[partnerId] = _demo(partnerId);
      notifyListeners();
      return;
    }
    _loading.add(partnerId);
    _errors.remove(partnerId);
    notifyListeners();
    try {
      final data = await _api.get('/partners/$partnerId/reviews/', auth: false, query: const {'page_size': '50'});
      final list = data is Map ? data['results'] : data;
      _byPartner[partnerId] = list is List
          ? list.whereType<Map>().map((e) => PartnerReview.fromJson(Map<String, dynamic>.from(e))).toList()
          : <PartnerReview>[];
    } catch (e) {
      _errors[partnerId] = e is ApiException ? e.message : 'Sharhlarni yuklab bo‘lmadi';
      if (kDebugMode) debugPrint('reviews $partnerId: $e');
    } finally {
      _loading.remove(partnerId);
      notifyListeners();
    }
  }

  /// Sharhni serverga yuboradi. Xato bo'lsa [ApiException] tashlanadi.
  Future<void> add({
    required int partnerId,
    required String author,
    required double stars,
    required String text,
  }) async {
    if (ApiConfig.useLocalData) {
      _byPartner.putIfAbsent(partnerId, () => []).insert(
            0,
            PartnerReview(
              id: DateTime.now().millisecondsSinceEpoch,
              partnerId: partnerId,
              author: author.isEmpty ? 'Siz' : author,
              stars: stars,
              text: text,
              createdAt: DateTime.now(),
            ),
          );
      notifyListeners();
      return;
    }
    final data = await _api.post('/partners/$partnerId/reviews/', body: {
      'score': stars.round().clamp(1, 5),
      'comment': text,
    });
    final saved = PartnerReview.fromJson(Map<String, dynamic>.from(data as Map));
    final list = _byPartner.putIfAbsent(partnerId, () => []);
    list.removeWhere((r) => r.id == saved.id);
    list.insert(0, saved);
    notifyListeners();
  }

  List<PartnerReview> _demo(int partnerId) => [
        PartnerReview(
          id: partnerId * 10 + 1,
          partnerId: partnerId,
          author: 'Aziza',
          stars: 5,
          text: 'Landshaft a’lo chiqdi!',
          createdAt: DateTime.now().subtract(const Duration(days: 3)),
        ),
        PartnerReview(
          id: partnerId * 10 + 2,
          partnerId: partnerId,
          author: 'Jasur',
          stars: 4,
          text: 'Vaqtida kelishdi.',
          createdAt: DateTime.now().subtract(const Duration(days: 8)),
        ),
      ];
}
