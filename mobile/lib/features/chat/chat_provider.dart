import 'package:flutter/foundation.dart';

import '../../core/network/models.dart';

class ChatProvider extends ChangeNotifier {
  final Map<int, List<ChatMessage>> _threads = {};

  List<ChatMessage> messagesFor(int partnerId) {
    _ensure(partnerId);
    return List.unmodifiable(_threads[partnerId]!);
  }

  void _ensure(int partnerId) {
    if (_threads.containsKey(partnerId)) return;
    _threads[partnerId] = [
      ChatMessage(
        id: 1,
        partnerId: partnerId,
        text: 'Assalomu alaykum! Qanday yordam bera olamiz?',
        fromMe: false,
        createdAt: DateTime.now().subtract(const Duration(minutes: 12)),
      ),
      ChatMessage(
        id: 2,
        partnerId: partnerId,
        text: 'Salom, bog‘im uchun maslahat kerak edi.',
        fromMe: true,
        createdAt: DateTime.now().subtract(const Duration(minutes: 10)),
      ),
      ChatMessage(
        id: 3,
        partnerId: partnerId,
        text: 'Albatta. Manzil va maydonni yuboring, yoki buyurtma bering.',
        fromMe: false,
        createdAt: DateTime.now().subtract(const Duration(minutes: 8)),
      ),
    ];
  }

  Future<void> send(int partnerId, String text) async {
    final t = text.trim();
    if (t.isEmpty) return;
    _ensure(partnerId);
    final list = _threads[partnerId]!;
    list.add(ChatMessage(
      id: list.length + 1,
      partnerId: partnerId,
      text: t,
      fromMe: true,
      createdAt: DateTime.now(),
    ));
    notifyListeners();

    // Demo avto-javob
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
