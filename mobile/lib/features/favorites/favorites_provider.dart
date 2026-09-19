import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FavoritesProvider extends ChangeNotifier {
  static const _svcKey = 'fav_services';
  static const _partnerKey = 'fav_partners';

  final Set<int> serviceIds = {};
  final Set<int> partnerIds = {};
  bool loaded = false;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    serviceIds
      ..clear()
      ..addAll(prefs.getStringList(_svcKey)?.map(int.parse) ?? const []);
    partnerIds
      ..clear()
      ..addAll(prefs.getStringList(_partnerKey)?.map(int.parse) ?? const []);
    loaded = true;
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_svcKey, serviceIds.map((e) => '$e').toList());
    await prefs.setStringList(_partnerKey, partnerIds.map((e) => '$e').toList());
  }

  bool isServiceFav(int id) => serviceIds.contains(id);
  bool isPartnerFav(int id) => partnerIds.contains(id);

  Future<void> toggleService(int id) async {
    if (!serviceIds.remove(id)) serviceIds.add(id);
    notifyListeners();
    await _persist();
  }

  Future<void> togglePartner(int id) async {
    if (!partnerIds.remove(id)) partnerIds.add(id);
    notifyListeners();
    await _persist();
  }
}
