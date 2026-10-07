import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/live_refresh.dart';
import '../../core/widgets/partner_sheet.dart';
import 'chat_provider.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.partner});

  final PartnerModel partner;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with LiveRefresh {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  bool _opening = true;
  bool _sending = false;
  bool _live = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _open());
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  /// Firma/operator javobi tez ko'rinsin: `?after=<oxirgi id>` bilan faqat yangilari olinadi.
  @override
  Duration get liveInterval => const Duration(milliseconds: 2500);

  @override
  bool get liveEnabled => _live;

  @override
  Future<void> liveRefresh() => _poll();

  Future<void> _open() async {
    setState(() {
      _opening = true;
      _error = null;
    });
    final chat = context.read<ChatProvider>();
    try {
      await chat.open(widget.partner);
      _live = !chat.isDemo(widget.partner.id);
    } on ApiException catch (e) {
      _error = e.statusCode == 401 || e.statusCode == 403
          ? 'Firma bilan yozishish uchun mijoz sifatida tizimga kiring.'
          : e.message;
    } catch (e) {
      _error = '$e';
    }
    if (!mounted) return;
    setState(() => _opening = false);
    _scrollToEnd(jump: true);
  }

  Future<void> _poll() async {
    try {
      final fresh = await context.read<ChatProvider>().poll(widget.partner.id);
      if (fresh) _scrollToEnd();
    } catch (_) {
      // Keyingi so'rovda qayta urinadi.
    }
  }

  void _scrollToEnd({bool jump = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      final end = _scroll.position.maxScrollExtent;
      if (jump) {
        _scroll.jumpTo(end);
      } else {
        _scroll.animateTo(end, duration: const Duration(milliseconds: 280), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    _input.clear();
    setState(() => _sending = true);
    try {
      final future = context.read<ChatProvider>().send(widget.partner.id, text);
      _scrollToEnd();
      await future;
    } catch (e) {
      if (mounted) {
        _input.text = text;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Yuborilmadi: $e'), behavior: SnackBarBehavior.floating),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
      _scrollToEnd();
    }
  }

  @override
  Widget build(BuildContext context) {
    final messages = context.watch<ChatProvider>().messagesFor(widget.partner.id);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            PartnerLogo(partner: widget.partner, size: 36),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.partner.name, style: const TextStyle(fontSize: 16), overflow: TextOverflow.ellipsis),
                  Text(
                    widget.partner.tagline.isEmpty ? 'Xizmat ko‘rsatuvchi firma' : widget.partner.tagline,
                    style: Theme.of(context).textTheme.labelSmall,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          if (widget.partner.phone.isNotEmpty)
            IconButton(
              tooltip: 'Qo‘ng‘iroq',
              icon: const Icon(Icons.phone_outlined),
              onPressed: () => launchPhone(widget.partner.phone),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(child: _body(messages)),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      enabled: !_opening && _error == null,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(
                        hintText: 'Xabar yozing…',
                        prefixIcon: Icon(Icons.chat_bubble_outline),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _opening || _error != null || _sending ? null : _send,
                    style: IconButton.styleFrom(backgroundColor: AppColors.primary),
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(List<ChatMessage> messages) {
    if (_opening && messages.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.forum_outlined, size: 48, color: AppColors.onSurfaceVariant),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _open, child: const Text('Qayta urinish')),
            ],
          ),
        ),
      );
    }
    if (messages.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            '${widget.partner.name} bilan suhbat shu yerda boshlanadi.\nSavolingizni yozing — firma xodimlari javob beradi.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.onSurfaceVariant, height: 1.4),
          ),
        ),
      );
    }
    return ListView.builder(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      itemCount: messages.length,
      itemBuilder: (_, i) {
        final m = messages[i];
        final prev = i > 0 ? messages[i - 1] : null;
        final newDay = prev == null || !DateUtils.isSameDay(prev.createdAt, m.createdAt);
        return Column(
          children: [
            if (newDay)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  DateFormat('d MMMM').format(m.createdAt),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ),
            _bubble(m),
          ],
        );
      },
    );
  }

  Widget _bubble(ChatMessage m) {
    final color = m.fromMe
        ? AppColors.primary.withValues(alpha: 0.28)
        : m.fromPlatform
            ? const Color(0xFF42A5F5).withValues(alpha: 0.18)
            : AppColors.surfaceContainerHigh;
    return Align(
      alignment: m.fromMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Opacity(
        opacity: m.pending ? 0.6 : 1,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.75),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(16).copyWith(
              bottomRight: m.fromMe ? const Radius.circular(4) : null,
              bottomLeft: m.fromMe ? null : const Radius.circular(4),
            ),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!m.fromMe && m.fromPlatform)
                const Padding(
                  padding: EdgeInsets.only(bottom: 4),
                  child: Text(
                    'E-Makon moderator',
                    style: TextStyle(color: Color(0xFF64B5F6), fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                ),
              Text(m.text, style: const TextStyle(height: 1.35)),
              const SizedBox(height: 4),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    DateFormat('HH:mm').format(m.createdAt),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(fontSize: 10),
                  ),
                  if (m.fromMe) ...[
                    const SizedBox(width: 4),
                    Icon(
                      m.pending ? Icons.schedule : Icons.done_rounded,
                      size: 12,
                      color: AppColors.onSurfaceVariant,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
