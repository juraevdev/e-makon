import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/chat_message.dart';
import '../models/notification_item.dart';
import '../models/order.dart';
import '../models/order_status.dart';
import '../models/user_profile.dart';
import '../data/chat_bot_engine.dart';
import '../core/storage/onboarding_storage.dart';

class AppState extends ChangeNotifier {
  bool _isAuthenticated = false;
  String? _phone;
  UserProfile _profile = UserProfile();
  final List<GardenOrder> _orders = [];
  final List<ChatMessage> _chatMessages = [];
  final List<AppNotification> _notifications = [];
  Timer? _statusTimer;

  bool get isAuthenticated => _isAuthenticated;
  String? get phone => _phone;
  UserProfile get profile => _profile;
  String? get userName => _profile.fullName.isNotEmpty ? _profile.fullName : null;
  List<GardenOrder> get orders => List.unmodifiable(_orders);
  List<ChatMessage> get chatMessages => List.unmodifiable(_chatMessages);
  List<AppNotification> get notifications => List.unmodifiable(_notifications);
  int get unreadCount => _notifications.where((n) => !n.isRead).length;

  UserStats get userStats {
    final completed =
        _orders.where((o) => o.status == OrderStatus.completed).length;
    final active = _orders.length;
    final profileBonus = _profile.isComplete ? 3 : 0;
    final locationBonus = _profile.hasLocation ? 2 : 0;
    final avatarBonus = _profile.hasAvatar ? 1 : 0;

    final plants = active * 2 + completed * 3 + profileBonus + avatarBonus;
    final gardens = active + completed + (_profile.hasLocation ? 1 : 0);
    final growth = (30 +
            active * 6 +
            completed * 10 +
            profileBonus * 5 +
            locationBonus * 5 +
            avatarBonus * 3)
        .clamp(0, 100);

    return UserStats(
      plants: plants.clamp(0, 999),
      gardens: gardens.clamp(0, 99),
      growthPercent: growth,
    );
  }

  AppState() {
    _startStatusWatcher();
  }

  void _startStatusWatcher() {
    _statusTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _simulateOrderUpdates();
    });
  }

  void _simulateOrderUpdates() {
    var changed = false;
    for (final order in _orders) {
      if (order.status == OrderStatus.newOrder) {
        order.status = OrderStatus.inReview;
        _pushNotification(
          title: 'So\'rov ko\'rib chiqilmoqda',
          body: '${order.serviceName} — mutaxassislar tekshirmoqda',
          type: NotificationType.order,
          orderId: order.id,
        );
        changed = true;
        break;
      }
    }
    if (changed) notifyListeners();
  }

  @override
  void dispose() {
    _statusTimer?.cancel();
    super.dispose();
  }

  void _pushNotification({
    required String title,
    required String body,
    required NotificationType type,
    String? orderId,
  }) {
    _notifications.insert(
      0,
      AppNotification(
        title: title,
        body: body,
        type: type,
        orderId: orderId,
      ),
    );
    notifyListeners();
  }

  void markAllNotificationsRead() {
    for (final n in _notifications) {
      n.isRead = true;
    }
    notifyListeners();
  }

  void markNotificationRead(String id) {
    final index = _notifications.indexWhere((n) => n.id == id);
    if (index != -1) {
      _notifications[index].isRead = true;
      notifyListeners();
    }
  }

  void login({required String phone}) {
    _isAuthenticated = true;
    _phone = phone;
    OnboardingStorage.markCompleted();
    if (_orders.isEmpty) _seedDemoOrders();
    _pushNotification(
      title: 'Tizimga kirdingiz',
      body: '$phone raqami bilan muvaffaqiyatli kirildi',
      type: NotificationType.auth,
    );
  }

  void _seedDemoOrders() {
    final now = DateTime.now();
    _orders.addAll([
      GardenOrder(
        id: 'demo_1',
        serviceId: 'pest_control',
        serviceName: 'Hasharotlarga qarshi dorilash',
        address: 'Toshkent, Chilonzor',
        area: '60 sotix',
        customerName: 'Demo',
        phone: _phone ?? '+998',
        status: OrderStatus.newOrder,
        createdAt: now.subtract(const Duration(days: 1)),
      ),
      GardenOrder(
        id: 'demo_2',
        serviceId: 'landscape_design',
        serviceName: 'Landshaft dizayn',
        address: 'Toshkent, Yunusobod',
        area: '200 m²',
        customerName: 'Demo',
        phone: _phone ?? '+998',
        status: OrderStatus.inReview,
        createdAt: now.subtract(const Duration(days: 3)),
      ),
      GardenOrder(
        id: 'demo_3',
        serviceId: 'lawn_care',
        serviceName: "Maysalarni o'rish xizmati",
        address: 'Samarqand',
        area: '120 m²',
        customerName: 'Demo',
        phone: _phone ?? '+998',
        status: OrderStatus.completed,
        createdAt: now.subtract(const Duration(days: 8)),
      ),
      GardenOrder(
        id: 'demo_4',
        serviceId: 'irrigation',
        serviceName: "Sug'orish tizimi o'rnatish",
        address: 'Toshkent',
        area: '80 sotix',
        customerName: 'Demo',
        phone: _phone ?? '+998',
        status: OrderStatus.cancelled,
        createdAt: now.subtract(const Duration(days: 12)),
      ),
      GardenOrder(
        id: 'demo_5',
        serviceId: 'free_consultation',
        serviceName: "Bog' audit xizmati",
        address: 'Buxoro',
        area: '40 sotix',
        customerName: 'Demo',
        phone: _phone ?? '+998',
        status: OrderStatus.completed,
        createdAt: now.subtract(const Duration(days: 15)),
      ),
    ]);
  }

  void logout() {
    _isAuthenticated = false;
    _phone = null;
    _profile = UserProfile();
    _pushNotification(
      title: 'Tizimdan chiqildi',
      body: 'Hisobingizdan muvaffaqiyatli chiqdingiz',
      type: NotificationType.auth,
    );
  }

  void notifyOtpSent(String phone) {
    _pushNotification(
      title: 'SMS kod yuborildi',
      body: '$phone raqamiga tasdiqlash kodi yuborildi',
      type: NotificationType.auth,
    );
  }

  void updateProfile(UserProfile profile) {
    _profile = profile;
    _pushNotification(
      title: 'Profil yangilandi',
      body: profile.fullName.isNotEmpty
          ? '${profile.fullName} ma\'lumotlari saqlandi'
          : 'Profil ma\'lumotlari saqlandi',
      type: NotificationType.profile,
    );
  }

  void notifyLocationObtained(String address) {
    _pushNotification(
      title: 'Joylashuv aniqlandi',
      body: address.isNotEmpty ? address : 'Lokatsiya muvaffaqiyatli olindi',
      type: NotificationType.profile,
    );
  }

  void notifyOrderStep(String stepName) {
    _pushNotification(
      title: 'Buyurtma bosqichi',
      body: '$stepName bosqichi yakunlandi',
      type: NotificationType.order,
    );
  }

  void addOrder(GardenOrder order) {
    _orders.insert(0, order);
    _pushNotification(
      title: 'So\'rov qabul qilindi',
      body: '${order.serviceName} — ${order.status.label}',
      type: NotificationType.order,
      orderId: order.id,
    );
  }

  void completeOrder(String orderId) {
    final order = _orders.where((o) => o.id == orderId).firstOrNull;
    if (order == null) return;
    order.status = OrderStatus.completed;
    _pushNotification(
      title: 'Ish yakunlandi',
      body: '${order.serviceName} — bajarildi deb belgilandi',
      type: NotificationType.order,
      orderId: order.id,
    );
    notifyListeners();
  }

  void updateOrderPhone(String orderId, String phone) {
    final order = _orders.where((o) => o.id == orderId).firstOrNull;
    if (order == null) return;
    order.phone = phone.trim();
    notifyListeners();
  }

  GardenOrder? findOrderById(String id) {
    return _orders.where((o) => o.id == id).firstOrNull;
  }

  void addChatMessage(ChatMessage message) {
    _chatMessages.add(message);
    if (message.sender == MessageSender.user) {
      _pushNotification(
        title: 'Chat xabari yuborildi',
        body: message.text.length > 50
            ? '${message.text.substring(0, 50)}...'
            : message.text,
        type: NotificationType.chat,
      );
    }
    notifyListeners();
  }

  void initChatBot() {
    if (_chatMessages.isNotEmpty) return;
    final firstName = _profile.firstName.trim().isNotEmpty
        ? _profile.firstName.trim()
        : null;
    _chatMessages.add(
      ChatMessage(
        text: ChatBotEngine.greeting(firstName: firstName),
        sender: MessageSender.bot,
        quickReplies: ChatBotEngine.greetingQuickReplies,
      ),
    );
    notifyListeners();
  }

  String? validateForOrder({String? firstName, String? lastName, String? address}) {
    final fn = (firstName ?? _profile.firstName).trim();
    final ln = (lastName ?? _profile.lastName).trim();
    var addr = (address ?? _profile.formattedAddress).trim();
    if (addr.isEmpty) {
      addr = _profile.homeAddress.trim();
    }

    if (fn.isEmpty) return 'Ismni kiriting';
    if (ln.isEmpty) return 'Familiyani kiriting';
    if (addr.length < 5) return 'Uy manzilini to\'liq kiriting';
    return null;
  }
}
