import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../../core/network/api_client.dart';
import '../../core/network/models.dart';

class OrdersProvider extends ChangeNotifier {
  OrdersProvider(this._api);

  final ApiClient _api;
  List<OrderModel> orders = [];
  bool loading = false;

  Future<void> load() async {
    loading = true;
    notifyListeners();
    try {
      final data = await _api.get('/orders/');
      final list = data is Map ? data['results'] : data;
      if (list is List) {
        orders = list
            .map((e) => OrderModel.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();
      }
    } catch (_) {
      // keep previous / empty
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<OrderModel> create({
    required int serviceId,
    String areaSize = '',
    String address = '',
    String notes = '',
    String phone = '',
    String firstName = '',
    String lastName = '',
    List<String> mediaPaths = const [],
  }) async {
    final Map<String, dynamic> data;
    if (mediaPaths.isEmpty) {
      data = Map<String, dynamic>.from(
        await _api.post('/orders/', body: {
          'service_id': serviceId,
          if (areaSize.isNotEmpty) 'area_size': areaSize,
          if (address.isNotEmpty) 'address': address,
          if (notes.isNotEmpty) 'notes': notes,
          if (phone.isNotEmpty) 'phone_number': phone,
          if (firstName.isNotEmpty) 'first_name': firstName,
          if (lastName.isNotEmpty) 'last_name': lastName,
        }) as Map,
      );
    } else {
      final files = <http.MultipartFile>[];
      for (final path in mediaPaths) {
        files.add(await http.MultipartFile.fromPath('media', path));
      }
      data = Map<String, dynamic>.from(
        await _api.postMultipart(
          '/orders/',
          fields: {
            'service_id': '$serviceId',
            if (areaSize.isNotEmpty) 'area_size': areaSize,
            if (address.isNotEmpty) 'address': address,
            if (notes.isNotEmpty) 'notes': notes,
            if (phone.isNotEmpty) 'phone_number': phone,
            if (firstName.isNotEmpty) 'first_name': firstName,
            if (lastName.isNotEmpty) 'last_name': lastName,
          },
          files: files,
        ) as Map,
      );
    }
    final order = OrderModel.fromJson(data);
    orders.insert(0, order);
    notifyListeners();
    return order;
  }
}

class CatalogProvider extends ChangeNotifier {
  CatalogProvider(this._api);

  final ApiClient _api;
  List<ServiceModel> services = ServiceModel.fallback;
  bool loading = false;
  String? error;

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final data = await _api.get('/services/', auth: false);
      final list = data is Map ? data['results'] : data;
      if (list is List && list.isNotEmpty) {
        services = list
            .map((e) => ServiceModel.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();
      }
    } catch (e) {
      error = e.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  ServiceModel? bySlug(String slug) {
    for (final s in services) {
      if (s.slug == slug) return s;
    }
    return null;
  }
}
