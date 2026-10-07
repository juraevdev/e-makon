import 'package:flutter/foundation.dart';

import '../../core/constants/api_config.dart';
import '../../core/network/api_client.dart';
import '../../core/network/models.dart';

/// Mijoz ↔ firma suhbati: har bir firma bilan alohida xona (`/chats/`).
class ChatProvider extends ChangeNotifier {
  ChatProvider(this._api);

  final ApiClient _api;
  final Map<int, List<ChatMessage>> _threads = {};
  final Map<int, int> _roomByPartner = {};
  final Set<int> _demoPartners = {};
  final Set<int> _polling = {};
  int _pendingId = -1;

  List<ChatRoomModel> rooms = [];
  bool roomsLoading = false;
  bool roomsLoaded = false;

  int get unreadTotal => rooms.fold(0, (s, r) => s + r.unread);

  /// Chiqishda — keyingi foydalanuvchiga oldingi suhbatlar ko'rinmasin.
  void reset() {
    _threads.clear();
    _roomByPartner.clear();
    _demoPartners.clear();
    rooms = [];
    roomsLoaded = false;
    notifyListeners();
  }

  List<ChatMessage> messagesFor(int partnerId) => List.unmodifiable(_threads[partnerId] ?? const []);

  bool isDemo(int partnerId) => _demoPartners.contains(partnerId);

  ChatRoomModel? roomById(int id) {
    for (final r in rooms) {
      if (r.id == id) return r;
    }
    return null;
  }

  Future<void> loadRooms() async {
    if (ApiConfig.useLocalData) return;
    roomsLoading = true;
    notifyListeners();
    try {
      final data = await _api.get('/chats/', query: {'page_size': '100'});
      final list = data is Map ? data['results'] : data;
      rooms = list is List
          ? list.whereType<Map>().map((e) => ChatRoomModel.fromJson(Map<String, dynamic>.from(e))).toList()
          : <ChatRoomModel>[];
      rooms.sort((a, b) => (b.lastMessageAt ?? DateTime(2000)).compareTo(a.lastMessageAt ?? DateTime(2000)));
      for (final r in rooms) {
        _roomByPartner[r.firmId] = r.id;
      }
      roomsLoaded = true;
    } catch (e) {
      if (kDebugMode) debugPrint('chat rooms: $e');
    } finally {
      roomsLoading = false;
      notifyListeners();
    }
  }

  /// Firma bilan xonani ochadi (yoki mavjudini topadi) va xabarlarni yuklaydi.
  Future<void> open(PartnerModel partner) async {
    if (ApiConfig.useLocalData || !partner.fromServer) {
      _ensureDemo(partner.id);
      return;
    }
    var roomId = _roomByPartner[partner.id];
    if (roomId == null) {
      final data = await _api.post('/chats/open/', body: {'firm_id': partner.id});
      final room = ChatRoomModel.fromJson(Map<String, dynamic>.from(data as Map));
      roomId = room.id;
      _roomByPartner[partner.id] = roomId;
      if (roomById(roomId) == null) rooms = [room, ...rooms];
    }
    await poll(partner.id);
    _markRoomRead(roomId);
  }

  /// Yangi xabarlarni oladi (`?after=` oxirgi xabar id si). Yangi xabar bo'lsa true.
  Future<bool> poll(int partnerId) async {
    final roomId = _roomByPartner[partnerId];
    if (roomId == null || _polling.contains(partnerId)) return false;
    _polling.add(partnerId);
    try {
      final list = _threads.putIfAbsent(partnerId, () => []);
      final confirmed = list.where((m) => !m.pending && m.id > 0);
      final lastId = confirmed.isEmpty ? 0 : confirmed.map((m) => m.id).reduce((a, b) => a > b ? a : b);
      final data = await _api.get(
        '/chats/$roomId/messages/',
        query: lastId > 0 ? {'after': '$lastId'} : null,
      );
      if (data is! List || data.isEmpty) return false;
      final known = list.map((m) => m.id).toSet();
      final fresh = data
          .whereType<Map>()
          .map((e) => ChatMessage.fromJson(Map<String, dynamic>.from(e), partnerId: partnerId))
          .where((m) => !known.contains(m.id))
          .toList();
      if (fresh.isEmpty) return false;
      list.addAll(fresh);
      notifyListeners();
      return true;
    } finally {
      _polling.remove(partnerId);
    }
  }

  void _markRoomRead(int roomId) {
    final i = rooms.indexWhere((r) => r.id == roomId);
    if (i < 0 || rooms[i].unread == 0) return;
    final r = rooms[i];
    rooms[i] = ChatRoomModel(
      id: r.id,
      firmId: r.firmId,
      firmName: r.firmName,
      firmPhone: r.firmPhone,
      lastMessageAt: r.lastMessageAt,
      lastMessagePreview: r.lastMessagePreview,
    );
    notifyListeners();
  }

  Future<void> send(int partnerId, String text) async {
    final t = text.trim();
    if (t.isEmpty) return;
    if (_demoPartners.contains(partnerId)) return _sendDemo(partnerId, t);

    final roomId = _roomByPartner[partnerId];
    if (roomId == null) throw ApiException('Suhbat hali ochilmagan');
    final list = _threads.putIfAbsent(partnerId, () => []);
    final pending = ChatMessage(
      id: _pendingId--,
      partnerId: partnerId,
      text: t,
      fromMe: true,
      createdAt: DateTime.now(),
      senderRole: 'customer',
      pending: true,
    );
    list.add(pending);
    notifyListeners();
    try {
      final data = await _api.post('/chats/$roomId/send/', body: {'body': t});
      final saved = ChatMessage.fromJson(Map<String, dynamic>.from(data as Map), partnerId: partnerId);
      list.remove(pending);
      if (!list.any((m) => m.id == saved.id)) list.add(saved);
      _touchRoom(roomId, t);
      notifyListeners();
    } catch (_) {
      list.remove(pending);
      notifyListeners();
      rethrow;
    }
  }

  void _touchRoom(int roomId, String preview) {
    final i = rooms.indexWhere((r) => r.id == roomId);
    if (i < 0) return;
    final r = rooms.removeAt(i);
    rooms.insert(
      0,
      ChatRoomModel(
        id: r.id,
        firmId: r.firmId,
        firmName: r.firmName,
        firmPhone: r.firmPhone,
        lastMessageAt: DateTime.now(),
        lastMessagePreview: preview,
      ),
    );
  }

  void _ensureDemo(int partnerId) {
    _demoPartners.add(partnerId);
    if (_threads.containsKey(partnerId)) return;
    _threads[partnerId] = [
      ChatMessage(
        id: 1,
        partnerId: partnerId,
        text: 'Assalomu alaykum! Qanday yordam bera olamiz?',
        fromMe: false,
        createdAt: DateTime.now().subtract(const Duration(minutes: 8)),
      ),
    ];
  }

  Future<void> _sendDemo(int partnerId, String text) async {
    final list = _threads[partnerId]!;
    list.add(ChatMessage(id: list.length + 1, partnerId: partnerId, text: text, fromMe: true, createdAt: DateTime.now()));
    notifyListeners();
    await Future<void>.delayed(const Duration(milliseconds: 900));
    list.add(ChatMessage(
      id: list.length + 1,
      partnerId: partnerId,
      text: 'Rahmat! Tez orada javob beramiz. Kerak bo‘lsa buyurtma orqali ham yuboring.',
      fromMe: false,
      createdAt: DateTime.now(),
    ));
    notifyListeners();
  }
}
