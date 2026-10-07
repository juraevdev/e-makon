import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

import '../../core/constants/api_config.dart';
import '../../core/data/demo_content.dart';
import '../../core/network/api_client.dart';
import '../../core/network/models.dart';
import '../../core/services/notification_service.dart';

class MessagesProvider extends ChangeNotifier {
  List<AppMessage> messages = ApiConfig.useLocalData ? List.of(DemoContent.messages) : <AppMessage>[];
  bool loading = false;
  bool serverOk = false;
  String? error;
  ApiClient? _api;

  int get unreadCount => messages.where((m) => !m.read).length;

  Future<void> load(ApiClient api, {bool silent = false}) async {
    _api = api;
    if (!silent) {
      loading = true;
      error = null;
      notifyListeners();
    }
    if (ApiConfig.useLocalData) {
      messages = List.of(DemoContent.messages);
      serverOk = false;
      loading = false;
      notifyListeners();
      return;
    }
    try {
      final data = await api.get('/notifications/', query: {'page_size': '100'});
      final list = data is Map ? data['results'] : data;
      messages = list is List
          ? list.map((e) => AppMessage.fromJson(Map<String, dynamic>.from(e as Map))).toList()
          : <AppMessage>[];
      serverOk = true;
    } catch (e) {
      error = e is ApiException ? e.message : 'Xabarlarni yuklab bo‘lmadi';
      if (kDebugMode) debugPrint('messages: $e');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  void markRead(int id) {
    final target = messages.where((m) => m.id == id).firstOrNull;
    if (target == null || target.read) return;
    messages = [for (final m in messages) m.id == id ? m.copyWith(read: true) : m];
    notifyListeners();
    if (serverOk) _api?.post('/notifications/$id/read/').ignore();
  }

  void markAllRead() {
    messages = [for (final m in messages) m.copyWith(read: true)];
    notifyListeners();
    if (serverOk) _api?.post('/notifications/read-all/').ignore();
  }
}

class HomeFeedProvider extends ChangeNotifier {
  List<CarouselItem> carousel = ApiConfig.useLocalData ? List.of(DemoContent.carousel) : <CarouselItem>[];
  List<PartnerModel> partners = ApiConfig.useLocalData ? List.of(DemoContent.partners) : <PartnerModel>[];

  /// Backendda "takliflar" endpointi yo'q — faqat demo rejimda to'ldiriladi.
  List<OfferModel> offers = ApiConfig.useLocalData ? List.of(DemoContent.offers) : <OfferModel>[];
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
    final results = await Future.wait([
      _tryGet(api, '/banners/'),
      _tryGet(api, '/partners/'),
    ]);
    // Server rejimida soxta kontent ko'rsatilmaydi; xatoda oxirgi muvaffaqiyatli ma'lumot qoladi.
    if (results[0] != null) carousel = _parseList(results[0], CarouselItem.fromJson);
    serverOk = results[1] != null;
    if (serverOk) {
      partners = _parseList(results[1], PartnerModel.fromJson);
    } else {
      error = 'Serverga ulanib bo‘lmadi. Pastga tortib yangilang';
    }
    loading = false;
    notifyListeners();
    await refreshLocation();
  }

  Future<dynamic> _tryGet(ApiClient api, String path) async {
    try {
      return await api.get(path, auth: false, query: const {'page_size': '100'});
    } catch (e) {
      if (kDebugMode) debugPrint('home feed $path: $e');
      return null;
    }
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

  PartnerModel? partnerById(int? id) {
    if (id == null) return null;
    for (final p in partners) {
      if (p.id == id) return p;
    }
    return null;
  }

  /// Tanlangan xizmatni tasdiqlangan narx bilan ko'rsatadigan firmalar (`offer` — firma narxi).
  Future<List<PartnerModel>> partnersForService(ApiClient api, int serviceId) async {
    if (ApiConfig.useLocalData) return List.of(partners);
    final data = await api.get('/partners/', auth: false, query: {
      'service': '$serviceId',
      'page_size': '100',
    });
    return _parseList(data, PartnerModel.fromJson);
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
  List<OrderModel> orders = ApiConfig.useLocalData ? List.of(DemoContent.sampleOrders) : <OrderModel>[];
  bool loading = false;
  bool serverOk = false;
  String? error;
  int _localId = 9000;

  void reset() {
    orders = ApiConfig.useLocalData ? List.of(DemoContent.sampleOrders) : <OrderModel>[];
    _localOrderIds.clear();
    serverOk = false;
    error = null;
    notifyListeners();
  }

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
      final data = await _api.get('/orders/', query: {'page_size': '100'});
      final list = data is Map ? data['results'] : data;
      orders = list is List
          ? list.map((e) => OrderModel.fromJson(Map<String, dynamic>.from(e as Map))).toList()
          : <OrderModel>[];
      serverOk = true;
    } catch (e) {
      serverOk = false;
      error = e is ApiException ? e.message : 'Buyurtmalarni yuklab bo‘lmadi';
      if (kDebugMode) debugPrint('orders: $e');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<OrderModel> cancel(int orderId) async {
    final i = orders.indexWhere((o) => o.id == orderId);
    if (i < 0) throw ApiException('Buyurtma topilmadi');
    if (!_isLocal(orderId)) {
      final data = await _api.post('/orders/$orderId/cancel/');
      final updated = orders[i].mergeServer(OrderModel.fromJson(Map<String, dynamic>.from(data as Map)));
      orders[i] = updated;
      notifyListeners();
      await NotificationService.instance.show(
        title: 'Buyurtma #$orderId',
        body: 'Holat: ${updated.statusLabel}',
      );
      return updated;
    }
    orders[i] = orders[i].copyWith(status: 'cancelled');
    notifyListeners();
    await NotificationService.instance.show(
      title: 'Buyurtma #$orderId',
      body: 'Holat: ${orders[i].statusLabel}',
    );
    return orders[i];
  }

  final _localOrderIds = <int>{};

  bool _isLocal(int orderId) => ApiConfig.useLocalData || _localOrderIds.contains(orderId);

  OrderModel _replace(int orderId, OrderModel Function(OrderModel current) update) {
    final i = orders.indexWhere((o) => o.id == orderId);
    if (i < 0) throw ApiException('Buyurtma topilmadi');
    orders[i] = update(orders[i]);
    notifyListeners();
    return orders[i];
  }

  /// Click/Payme to'lovini boshlaydi. Natijadagi `checkoutUrl` bo'sh bo'lsa, to'lov tizimi ulanmagan.
  Future<OrderModel> startPayment(int orderId, String provider) async {
    if (_isLocal(orderId)) {
      return _replace(orderId, (o) => o.copyWith(paymentStatus: 'unpaid', paymentProvider: provider));
    }
    final data = await _api.post('/orders/$orderId/pay/', body: {'provider': provider});
    final map = Map<String, dynamic>.from(data as Map);
    final server = OrderModel.fromJson(Map<String, dynamic>.from(map['order'] as Map));
    return _replace(orderId, (o) => o.mergeServer(server));
  }

  /// Click/Payme ulanmagan davrda sinov to'lovi: server to'lovni darhol tasdiqlaydi va buyurtma firmaga tushadi.
  Future<OrderModel> payTest(int orderId) async {
    if (_isLocal(orderId)) {
      return _replace(orderId, (o) => o.copyWith(paymentStatus: 'paid', paymentProvider: 'test'));
    }
    final data = await _api.post('/orders/$orderId/test-pay/');
    final server = OrderModel.fromJson(Map<String, dynamic>.from(data as Map));
    return _replace(orderId, (o) => o.mergeServer(server));
  }

  Future<OrderModel> markPaymentSent(int orderId) async {
    if (_isLocal(orderId)) {
      return _replace(orderId, (o) => o.copyWith(paymentStatus: 'checking'));
    }
    final data = await _api.post('/orders/$orderId/payment-sent/');
    final server = OrderModel.fromJson(Map<String, dynamic>.from(data as Map));
    return _replace(orderId, (o) => o.mergeServer(server));
  }

  Future<OrderModel> refreshOrder(int orderId) async {
    if (_isLocal(orderId)) {
      return orders.firstWhere((o) => o.id == orderId);
    }
    final data = await _api.get('/orders/$orderId/');
    final server = OrderModel.fromJson(Map<String, dynamic>.from(data as Map));
    return _replace(orderId, (o) => o.mergeServer(server));
  }

  @Deprecated('Customer statusni o‘zgartirmaydi — faqat admin/firma')
  Future<void> advanceStatus(int orderId) async {
    // no-op: backend statuslari customer tomonidan o‘zgartirilmaydi
  }

  /// Buyurtmani rasmlari bilan birga (multipart) yuboradi.
  /// [idempotencyKey] — bitta "Yuborish" urinishi uchun bir xil: tarmoq uzilib qayta yuborilsa ham
  /// server ikkinchi buyurtma yaratmaydi.
  Future<OrderModel> create({
    required List<ServiceModel> services,
    required String areaSize,
    required String address,
    required String notes,
    required String idempotencyKey,
    String phone = '',
    String partnerName = '',
    int? firmId,
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
        final fields = <String, String>{
          'service_id': '${services.first.id}',
          for (var i = 0; i < services.length; i++) 'service_ids[$i]': '${services[i].id}',
          'area_size': areaSize,
          'address': address,
          'notes': notes,
          if (phone.isNotEmpty) 'phone_number': phone,
          if (firmId != null) 'firm_id': '$firmId',
          if (lat != null) 'lat': lat.toStringAsFixed(6),
          if (lng != null) 'lng': lng.toStringAsFixed(6),
          if (scheduledDate != null)
            'scheduled_date':
                '${scheduledDate.year.toString().padLeft(4, '0')}-${scheduledDate.month.toString().padLeft(2, '0')}-${scheduledDate.day.toString().padLeft(2, '0')}',
          if (timeSlot.isNotEmpty) 'time_slot': timeSlot,
        };
        final data = await _api.postMultipart(
          '/orders/',
          fields: fields,
          files: [for (final path in mediaPaths) () => http.MultipartFile.fromPath('media', path)],
          idempotencyKey: idempotencyKey,
        );
        final order = OrderModel.fromJson(Map<String, dynamic>.from(data as Map));
        final serverAmount = order.amount > 0 ? order.amount : amount;
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
          amount: serverAmount,
          // Ballar buyurtma bajarilgach serverda yoziladi — bu yerda faqat server qiymati.
          pointsEarned: order.pointsEarned,
          serviceNames: names,
          receiptCode: order.receiptCode.isNotEmpty ? order.receiptCode : 'EM-${order.id}',
          scheduledDate: scheduledDate,
          timeSlot: timeSlot,
          lat: lat,
          lng: lng,
          partnerLat: partnerLat,
          partnerLng: partnerLng,
          paymentStatus: order.paymentStatus,
        ).mergeServer(order);
        orders.insert(0, enriched);
        notifyListeners();
        return enriched;
      } on ApiException {
        // Buyurtma serverga (firmaga) yetmagan bo'lsa, telefonda soxta buyurtma yaratilmaydi.
        rethrow;
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
      paymentStatus: amount > 0 ? 'unpaid' : 'not_required',
    );
    _localOrderIds.add(local.id);
    orders.insert(0, local);
    notifyListeners();
    return local;
  }
}

class CatalogProvider extends ChangeNotifier {
  CatalogProvider(this._api);

  final ApiClient _api;
  List<ServiceModel> services = ApiConfig.useLocalData ? List.of(DemoContent.catalogWithPrices) : <ServiceModel>[];
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
    _offers.clear();
    try {
      final data = await _api.get('/services/', auth: false, query: const {'page_size': '100'});
      final list = data is Map ? data['results'] : data;
      // Demo xizmatlarning id lari serverda yo'q — ular bilan buyurtma berib bo'lmaydi, shuning uchun
      // server rejimida hech qachon demo katalogga tushmaymiz.
      services = list is List
          ? list.map((e) => ServiceModel.fromJson(Map<String, dynamic>.from(e as Map))).toList()
          : <ServiceModel>[];
      serverOk = true;
    } catch (e) {
      serverOk = false;
      error = e is ApiException ? e.message : 'Xizmatlarni yuklab bo‘lmadi';
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

  final _offers = <String, List<ServiceOffer>>{};

  /// Xizmatni ko'rsatadigan firmalar va ularning qat'iy narxlari (arzonidan qimmatiga).
  Future<List<ServiceOffer>> offersFor(ServiceModel service, {bool refresh = false}) async {
    if (ApiConfig.useLocalData || service.slug.isEmpty) return const [];
    final cached = _offers[service.slug];
    if (cached != null && !refresh) return cached;
    final data = await _api.get('/services/${service.slug}/offers/', auth: false);
    final list = data is Map ? data['results'] : data;
    final offers = list is List
        ? list.whereType<Map>().map((e) => ServiceOffer.fromJson(Map<String, dynamic>.from(e))).toList()
        : <ServiceOffer>[];
    _offers[service.slug] = offers;
    return offers;
  }

  /// Firma ushbu xizmat uchun belgilagan narx (taklif bo'lmasa — null).
  Future<int?> firmPrice(ServiceModel service, int firmId) async {
    try {
      final offers = await offersFor(service);
      for (final o in offers) {
        if (o.firm?.id == firmId) return o.price;
      }
    } catch (e) {
      if (kDebugMode) debugPrint('firm price: $e');
    }
    return null;
  }
}
