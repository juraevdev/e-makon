enum NotificationType {
  auth,
  profile,
  order,
  system,
  chat,
}

class AppNotification {
  AppNotification({
    required this.title,
    required this.body,
    required this.type,
    this.orderId,
    this.isRead = false,
    DateTime? createdAt,
    String? id,
  })  : id = id ?? DateTime.now().microsecondsSinceEpoch.toString(),
        createdAt = createdAt ?? DateTime.now();

  final String id;
  final String title;
  final String body;
  final NotificationType type;
  final String? orderId;
  bool isRead;
  final DateTime createdAt;
}
