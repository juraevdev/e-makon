import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/constants/api_config.dart';
import '../../core/data/demo_content.dart';
import '../../core/network/api_client.dart';
import '../../core/network/models.dart';
import '../../core/services/notification_service.dart';

class MessagesProvider extends ChangeNotifier {
  List<AppMessage> messages = List.of(DemoContent.messages);
  bool loading = false;
  bool serverOk = false;
  String? error;

  int get unreadCount => messages.where((m) => !m.read).length;

  Future<void> load(ApiClient api) async {
    loading = true;
    error = null;
    notifyListeners();
    if (ApiConfig.useLocalData) {
      messages = List.of(DemoContent.messages);
      serverOk = false;
      loading = false;
      notifyListeners();
      return;
    }
    try {
      final data = await api.get('/notifications/');
      final list = data is Map ? data['results'] : data;
      if (list is List && list.isNotEmpty) {
        messages = list
            .map((e) => AppMessage.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();
        serverOk = true;
      } else {
        messages = List.of(DemoContent.messages);
        serverOk = true;
      }
    } catch (e) {
      messages = List.of(DemoContent.messages);
      serverOk = false;
      error = null;
      if (kDebugMode) debugPrint('messages: $e');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  void markRead(int id) {
    messages = [for (final m in messages) m.id == id ? m.copyWith(read: true) : m];
    notifyListeners();
  }

  void markAllRead() {
    messages = [for (final m in messages) m.copyWith(read: true)];
    notifyListeners();
  }
}

class HomeFeedProvider extends ChangeNotifier {
  List<CarouselItem> carousel = List.of(DemoContent.carousel);
  List<PartnerModel> partners = List.of(DemoContent.partners);
  List<OfferModel> offers = List.of(DemoContent.offers);
  bool loading = false;
  bool serverOk = false;
  String? error;

  double? userLat;
  double? userLng;

  Future<void> load(ApiClient api) async {
    loading = true;
    error = null;
    notifyListeners();
    if (ApiConfig.useLocalData) {
      carousel = List.of(DemoContent.carousel);
      partners = List.of(DemoContent.partners);
      offers = List.of(DemoContent.offers);
      serverOk = false;
      loading = false;
      notifyListeners();
      await refreshLocation();
      return;
    }
    try {
      final results = await Future.wait([
        api.get('/home/carousel/', auth: false),
        api.get('/partners/', auth: false),
        api.get('/offers/', auth: false),
      ]);
      final c = _parseList(results[0], CarouselItem.fromJson);
      final p = _parseList(results[1], PartnerModel.fromJson);
      final o = _parseList(results[2], OfferModel.fromJson);
      carousel = c.isNotEmpty ? c : List.of(DemoContent.carousel);
      partners = p.isNotEmpty ? p : List.of(DemoContent.partners);
      offers = o.isNotEmpty ? o : List.of(DemoContent.offers);
      serverOk = true;
    } catch (e) {
      carousel = List.of(DemoContent.carousel);
      partners = List.of(DemoContent.partners);
      offers = List.of(DemoContent.offers);
      serverOk = false;
      error = null;
      if (kDebugMode) debugPrint('home feed: $e');
    } finally {
      loading = false;
      notifyListeners();
    }
    await refreshLocation();
  }

  List<T> _parseList<T>(dynamic data, T Function(Map<String, dynamic>) fromJson) {
    final list = data is Map ? data['results'] : data;
    if (list is! List) return [];
    return list.map((e) => fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Future<void> refreshLocation() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      userLat = pos.latitude;
      userLng = pos.longitude;
      notifyListeners();
    } catch (e) {
      if (kDebugMode) debugPrint('location: $e');
    }
  }

  double distanceKm(PartnerModel p) {
    if (userLat == null || userLng == null) return -1;
    return Geolocator.distanceBetween(userLat!, userLng!, p.lat, p.lng) / 1000;
  }

  List<PartnerModel> get nearestPartners {
    if (partners.isEmpty) return [];
    final sorted = [...partners];
    if (userLat != null && userLng != null) {
      sorted.sort((a, b) => distanceKm(a).compareTo(distanceKm(b)));
    }
    return sorted.take(5).toList();
  }
}

class OrdersProvider extends ChangeNotifier {
  OrdersProvider(this._api);

  final ApiClient _api;
  List<OrderModel> orders = List.of(DemoContent.sampleOrders);
  bool loading = false;
  bool serverOk = false;
  String? error;
  int _localId = 9000;

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    if (ApiConfig.useLocalData) {
      orders = List.of(DemoContent.sampleOrders);
      serverOk = false;
      loading = false;
      notifyListeners();
      return;
    }
    try {
      final data = await _api.get('/orders/');
      final list = data is Map ? data['results'] : data;
      if (list is List && list.isNotEmpty) {
        orders = list.map((e) => OrderModel.fromJson(Map<String, dynamic>.from(e as Map))).toList();
        serverOk = true;
      } else {
        orders = List.of(DemoContent.sampleOrders);
        serverOk = true;
      }
    } catch (e) {
      if (orders.isEmpty) orders = List.of(DemoContent.sampleOrders);
      serverOk = false;
      error = null;
      if (kDebugMode) debugPrint('orders: $e');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> advanceStatus(int orderId) async {
    final i = orders.indexWhere((o) => o.id == orderId);
    if (i < 0) return;
    final cur = orders[i].status;
    final next = switch (cur) {
      'new' => 'accepted',
      'accepted' => 'on_way',
      'on_way' => 'arrived',
      'arrived' => 'done',
      'in_progress' => 'done',
      _ => cur,
    };
    if (!ApiConfig.useLocalData) {
      try {
        await _api.patch('/orders/$orderId/', body: {'status': next});
      } catch (_) {}
    }
    orders[i] = orders[i].copyWith(status: next);
    notifyListeners();
    await NotificationService.instance.show(
      title: 'Buyurtma #${orders[i].id}',
      body: 'Holat: ${orders[i].statusLabel}',
    );
  }

  Future<OrderModel> create({
    required List<ServiceModel> services,
    required String areaSize,
    required String address,
    required String notes,
    String phone = '',
    String partnerName = '',
    double distanceKm = 0,
    List<String> mediaPaths = const [],
    DateTime? scheduledDate,
    String timeSlot = '',
    double? lat,
    double? lng,
    double? partnerLat,
    double? partnerLng,
    int? estimatedAmount,
  }) async {
    if (services.isEmpty) {
      throw ApiException('Kamida 1 ta xizmat tanlang');
    }
    final amount = estimatedAmount ??
        services.fold<int>(0, (s, e) => s + (e.priceMin > 0 ? e.priceMin : 0));
    final names = services.map((e) => e.name).toList();

    if (!ApiConfig.useLocalData) {
      try {
        final data = await _api.post('/orders/', body: {
          'service_ids': services.map((e) => e.id).toList(),
          'service_id': services.first.id,
          'area_size': areaSize,
          'address': address,
          'notes': notes,
          if (phone.isNotEmpty) 'phone_number': phone,
          if (partnerName.isNotEmpty) 'partner_name': partnerName,
          'amount': amount,
          'media_count': mediaPaths.length,
          if (scheduledDate != null) 'scheduled_date': scheduledDate.toIso8601String(),
          if (timeSlot.isNotEmpty) 'time_slot': timeSlot,
        });
        final order = OrderModel.fromJson(Map<String, dynamic>.from(data as Map));
        final enriched = OrderModel(
          id: order.id,
          status: order.status,
          serviceName: names.join(', '),
          createdAt: order.createdAt,
          areaSize: areaSize,
          phoneNumber: phone,
          address: address,
          notes: notes,
          partnerName: partnerName,
          distanceKm: distanceKm,
          amount: amount > 0 ? amount : order.amount,
          pointsEarned: OrderModel.pointsForAmount(amount > 0 ? amount : order.amount),
          serviceNames: names,
          receiptCode: order.receiptCode.isNotEmpty ? order.receiptCode : 'EM-${order.id}',
          scheduledDate: scheduledDate,
          timeSlot: timeSlot,
          lat: lat,
          lng: lng,
          partnerLat: partnerLat,
          partnerLng: partnerLng,
        );
        orders.insert(0, enriched);
        notifyListeners();
        return enriched;
      } catch (_) {
        // fall through to local
      }
    }

    _localId += 1;
    final local = OrderModel(
      id: _localId,
      status: 'new',
      serviceName: names.join(', '),
      createdAt: DateTime.now(),
      areaSize: areaSize,
      phoneNumber: phone,
      address: address,
      notes: notes,
      partnerName: partnerName,
      distanceKm: distanceKm,
      amount: amount,
      pointsEarned: OrderModel.pointsForAmount(amount),
      serviceNames: names,
      receiptCode: 'EM-$_localId',
      scheduledDate: scheduledDate,
      timeSlot: timeSlot,
      lat: lat,
      lng: lng,
      partnerLat: partnerLat,
      partnerLng: partnerLng,
    );
    orders.insert(0, local);
    notifyListeners();
    return local;
  }
}

class CatalogProvider extends ChangeNotifier {
  CatalogProvider(this._api);

  final ApiClient _api;
  List<ServiceModel> services = List.of(DemoContent.catalogWithPrices);
  bool loading = false;
  bool serverOk = false;
  String? error;

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    if (ApiConfig.useLocalData) {
      services = List.of(DemoContent.catalogWithPrices);
      serverOk = false;
      loading = false;
      notifyListeners();
      return;
    }
    try {
      final data = await _api.get('/services/', auth: false);
      final list = data is Map ? data['results'] : data;
      if (list is List && list.isNotEmpty) {
        services = list
            .map((e) => ServiceModel.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();
        serverOk = true;
      } else {
        services = List.of(DemoContent.catalogWithPrices);
        serverOk = true;
      }
    } catch (e) {
      services = List.of(DemoContent.catalogWithPrices);
      serverOk = false;
      error = null;
      if (kDebugMode) debugPrint('catalog: $e');
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
