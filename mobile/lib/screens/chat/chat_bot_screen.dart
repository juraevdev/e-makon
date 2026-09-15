import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../data/chat_bot_engine.dart';
import '../../models/chat_message.dart';
import '../../providers/app_state.dart';
import '../../widgets/chat_bubble.dart';
import '../order/order_flow_screen.dart';

class ChatBotScreen extends StatefulWidget {
  const ChatBotScreen({super.key});

  @override
  State<ChatBotScreen> createState() => _ChatBotScreenState();
}

class _ChatBotScreenState extends State<ChatBotScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  bool _isTyping = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppState>().initChatBot();
      _scrollToBottom();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 150), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _sendMessage(String text) {
    if (text.trim().isEmpty) return;
    final state = context.read<AppState>();

    state.addChatMessage(
      ChatMessage(text: text.trim(), sender: MessageSender.user),
    );
    _controller.clear();
    _scrollToBottom();

    setState(() => _isTyping = true);

    Future.delayed(const Duration(milliseconds: 1200), () {
      if (!mounted) return;
      setState(() => _isTyping = false);
      _botReply(text.trim(), state);
    });
  }

  void _botReply(String userText, AppState state) {
    final firstName = state.profile.firstName.trim().isNotEmpty
        ? state.profile.firstName.trim()
        : null;

    final result = ChatBotEngine.respond(userText, firstName: firstName);

    state.addChatMessage(
      ChatMessage(
        text: result.text,
        sender: MessageSender.bot,
        quickReplies: result.quickReplies,
      ),
    );
    _scrollToBottom();
  }

  void _handleQuickReply(String reply) {
    if (ChatBotEngine.shouldOpenOrder(reply)) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const OrderFlowScreen()),
      );
      return;
    }

    final service = ChatBotEngine.serviceFromQuickReply(reply);
    if (service != null) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => OrderFlowScreen(preselectedServiceId: service.id),
        ),
      );
      return;
    }

    if (reply == 'Boshqa xizmat ko\'rsat' || reply == 'Avval maslahat olish') {
      _sendMessage(reply);
      return;
    }

    _sendMessage(reply);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: AppColors.cardGradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.spa_outlined,
                color: AppColors.white,
                size: 20,
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppStrings.chatBotTitle,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  AppStrings.chatBotSubtitle,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: AppColors.mutedText,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: Consumer<AppState>(
              builder: (context, state, _) {
                return ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.all(16),
                  itemCount: state.chatMessages.length + (_isTyping ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (_isTyping && index == state.chatMessages.length) {
                      return _typingIndicator();
                    }

                    final msg = state.chatMessages[index];
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ChatBubble(message: msg),
                        if (msg.quickReplies != null &&
                            msg.quickReplies!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8, left: 4),
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: msg.quickReplies!.map((r) {
                                return ActionChip(
                                  label: Text(r),
                                  onPressed: () => _handleQuickReply(r),
                                  backgroundColor: AppColors.paleGreen,
                                  labelStyle: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: AppColors.forestGreen,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  side: BorderSide.none,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                      ],
                    );
                  },
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            decoration: BoxDecoration(
              color: AppColors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 8,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: InputDecoration(
                        hintText: AppStrings.chatInputHint,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                      ),
                      onSubmitted: _sendMessage,
                    ),
                  ),
                  const SizedBox(width: 8),
                  CircleAvatar(
                    backgroundColor: AppColors.forestGreen,
                    child: IconButton(
                      icon: const Icon(
                        Icons.send_rounded,
                        color: AppColors.white,
                        size: 20,
                      ),
                      onPressed: () => _sendMessage(_controller.text),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _typingIndicator() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, left: 4),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
                bottomRight: Radius.circular(16),
                bottomLeft: Radius.circular(4),
              ),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'yozmoqda',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: AppColors.mutedText,
                    fontStyle: FontStyle.italic,
                  ),
                ),
                const SizedBox(width: 6),
                SizedBox(
                  width: 24,
                  height: 12,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: List.generate(3, (i) {
                      return Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: AppColors.forestGreen.withValues(alpha: 0.5),
                          shape: BoxShape.circle,
                        ),
                      );
                    }),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
