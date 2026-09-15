enum MessageSender { user, bot }

class ChatMessage {
  ChatMessage({
    required this.text,
    required this.sender,
    DateTime? timestamp,
    this.quickReplies,
  }) : timestamp = timestamp ?? DateTime.now();

  final String text;
  final MessageSender sender;
  final DateTime timestamp;
  final List<String>? quickReplies;
}
