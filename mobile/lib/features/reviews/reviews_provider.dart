import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/network/models.dart';

class ReviewsProvider extends ChangeNotifier {
  final Map<int, List<PartnerReview>> _byPartner = {};
  bool loaded = false;

  List<PartnerReview> forPartner(int partnerId) =>
      List.unmodifiable(_byPartner[partnerId] ?? const []);

  double average(int partnerId, {double fallback = 4.8}) {
    final list = _byPartner[partnerId];
    if (list == null || list.isEmpty) return fallback;
    return list.map((e) => e.stars).reduce((a, b) => a + b) / list.length;
  }

  Future<void> load() async {
    // Demo sharhlar
    _byPartner
      ..clear()
      ..addAll({
        1: [
          PartnerReview(id: 1, partnerId: 1, author: 'Aziza', stars: 5, text: 'Landshaft a’lo chiqdi!', createdAt: DateTime.now().subtract(const Duration(days: 3))),
          PartnerReview(id: 2, partnerId: 1, author: 'Jasur', stars: 4, text: 'Vaqtida kelishdi.', createdAt: DateTime.now().subtract(const Duration(days: 8))),
        ],
        2: [
          PartnerReview(id: 3, partnerId: 2, author: 'Dilnoza', stars: 5, text: 'Sug‘orish tizimi zo‘r.', createdAt: DateTime.now().subtract(const Duration(days: 2))),
        ],
        3: [
          PartnerReview(id: 4, partnerId: 3, author: 'Bobur', stars: 5, text: 'Daraxtlar chiroyli ekildi.', createdAt: DateTime.now().subtract(const Duration(days: 5))),
        ],
      });

    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getStringList('user_reviews') ?? [];
      for (final line in raw) {
        final parts = line.split('|');
        if (parts.length < 5) continue;
        final r = PartnerReview(
          id: int.tryParse(parts[0]) ?? 0,
          partnerId: int.tryParse(parts[1]) ?? 0,
          author: parts[2],
          stars: double.tryParse(parts[3]) ?? 5,
          text: parts[4],
          createdAt: DateTime.tryParse(parts.length > 5 ? parts[5] : '') ?? DateTime.now(),
        );
        _byPartner.putIfAbsent(r.partnerId, () => []).insert(0, r);
      }
    } catch (e) {
      if (kDebugMode) debugPrint('reviews load: $e');
    }
    loaded = true;
    notifyListeners();
  }

  Future<void> add({
    required int partnerId,
    required String author,
    required double stars,
    required String text,
  }) async {
    final r = PartnerReview(
      id: DateTime.now().millisecondsSinceEpoch,
      partnerId: partnerId,
      author: author.isEmpty ? 'Siz' : author,
      stars: stars,
      text: text,
      createdAt: DateTime.now(),
    );
    _byPartner.putIfAbsent(partnerId, () => []).insert(0, r);
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getStringList('user_reviews') ?? [];
      raw.add('${r.id}|${r.partnerId}|${r.author}|${r.stars}|${r.text}|${r.createdAt.toIso8601String()}');
      await prefs.setStringList('user_reviews', raw);
    } catch (_) {}
  }
}
