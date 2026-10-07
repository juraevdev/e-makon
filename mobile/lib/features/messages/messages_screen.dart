import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/season_theme.dart';
import '../../core/utils/live_refresh.dart';
import '../../core/widgets/motion.dart';
import '../../core/widgets/partner_sheet.dart';
import '../../core/widgets/widgets.dart';
import '../chat/chat_provider.dart';
import '../home/catalog_provider.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> with LiveRefresh {
  String _filter = 'all';
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final api = context.read<ApiClient>();
      context.read<MessagesProvider>().load(api);
      context.read<ChatProvider>().loadRooms();
    });
  }

  /// Yangi bildirishnoma va firma javoblari (o'qilmagan soni) tez ko'rinsin.
  @override
  Duration get liveInterval => const Duration(seconds: 10);

  @override
  Future<void> liveRefresh() async {
    final api = context.read<ApiClient>();
    final chat = context.read<ChatProvider>();
    await Future.wait([
      context.read<MessagesProvider>().load(api, silent: true),
      chat.loadRooms(silent: true),
    ]);
  }

  Color _typeColor(String type, SeasonTheme season) => switch (type) {
        'offer' => Color.lerp(season.accent, const Color(0xFF64B5F6), 0.45)!,
        'bonus' => Color.lerp(season.accent, const Color(0xFFFFB74D), 0.35)!,
        'subscription' => Color.lerp(season.accentSoft, const Color(0xFFBA68C8), 0.4)!,
        'order' => Color.lerp(season.accent, const Color(0xFFFFB300), 0.5)!,
        'chat' => Color.lerp(season.accent, const Color(0xFF29B6F6), 0.5)!,
        'care' => Color.lerp(season.accent, const Color(0xFFAB47BC), 0.5)!,
        _ => season.accent,
      };

  IconData _typeIcon(String type) => switch (type) {
        'offer' => Icons.local_offer_rounded,
        'bonus' => Icons.stars_rounded,
        'subscription' => Icons.workspace_premium_rounded,
        'order' => Icons.local_shipping_outlined,
        'chat' => Icons.forum_rounded,
        'care' => Icons.handshake_outlined,
        _ => Icons.notifications_active_rounded,
      };

  String _typeLabel(String type) => switch (type) {
        'offer' => 'Taklif',
        'bonus' => 'Bonus',
        'subscription' => 'Obuna',
        'order' => 'Buyurtma',
        'chat' => 'Suhbat',
        'care' => 'Shartnoma',
        _ => 'Tizim',
      };

  PartnerModel _partnerForRoom(ChatRoomModel room) {
    return context.read<HomeFeedProvider>().partnerById(room.firmId) ??
        PartnerModel(
          id: room.firmId,
          name: room.firmName,
          tagline: '',
          emoji: '🌿',
          phone: room.firmPhone,
          fromServer: true,
        );
  }

  Future<void> _openRoom(ChatRoomModel room) async {
    final chat = context.read<ChatProvider>();
    await context.push('/chat', extra: _partnerForRoom(room));
    if (mounted) chat.loadRooms();
  }

  /// Buyurtma yoki suhbat haqidagi bildirishnoma — to'g'ridan-to'g'ri o'sha ekranga.
  Future<bool> _openLinked(AppMessage m) async {
    final id = m.entityId;
    if (id == null) return false;
    if (m.entityType == 'order') {
      final order = context.read<OrdersProvider>().orders.where((o) => o.id == id).firstOrNull;
      if (order == null) return false;
      context.push('/order-detail', extra: order);
      return true;
    }
    if (m.entityType == 'chat_room') {
      final chat = context.read<ChatProvider>();
      if (chat.roomById(id) == null) await chat.loadRooms();
      final room = chat.roomById(id);
      if (room == null || !mounted) return false;
      await _openRoom(room);
      return true;
    }
    return false;
  }

  Future<void> _openMessage(AppMessage m, MessagesProvider provider, SeasonTheme season) async {
    provider.markRead(m.id);
    if (await _openLinked(m) || !mounted) return;
    final color = _typeColor(m.type, season);
    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: AppColors.surfaceContainer,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 12, 20, 28 + MediaQuery.paddingOf(ctx).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: AppColors.outlineVariant, borderRadius: BorderRadius.circular(99)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: LinearGradient(
                      colors: [color.withValues(alpha: 0.35), season.glowA.withValues(alpha: 0.25)],
                    ),
                  ),
                  child: Icon(_typeIcon(m.type), color: color, size: 28),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(_typeLabel(m.type),
                            style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                      const SizedBox(height: 6),
                      Text(m.title, style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(m.body, style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(height: 1.45)),
            const SizedBox(height: 12),
            Text(
              DateFormat('d MMMM yyyy, HH:mm').format(m.createdAt),
              style: Theme.of(ctx).textTheme.labelSmall,
            ),
            const SizedBox(height: 20),
            PrimaryButton(
              label: 'Yopish',
              onPressed: () => Navigator.pop(ctx),
              roundedFull: true,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagesProvider>();
    final season = SeasonTheme.of();
    final accent = season.accent;
    final filtered = provider.messages.where((m) {
      if (_filter == 'unread') return !m.read;
      if (_filter == 'all') return true;
      return m.type == _filter;
    }).toList();

    return Scaffold(
      body: AmbientBackdrop(
        intensity: 0.95,
        season: season,
        showWeather: true,
        child: SafeArea(
          bottom: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 12, 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  season.subtitle,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                        color: accent,
                                        letterSpacing: 0.2,
                                      ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              SeasonChip(theme: season),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Xabarlar',
                            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 26,
                                ),
                          ),
                          Text(
                            provider.unreadCount > 0
                                ? '${provider.unreadCount} ta o‘qilmagan'
                                : 'Barcha xabarlar o‘qilgan',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: season.accentSoft.withValues(alpha: 0.9),
                                ),
                          ),
                        ],
                      ),
                    ),
                    if (provider.unreadCount > 0)
                      TextButton.icon(
                        onPressed: provider.markAllRead,
                        icon: Icon(Icons.done_all_rounded, size: 18, color: accent),
                        label: Text('O‘qish', style: TextStyle(color: accent, fontWeight: FontWeight.w700)),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: Row(
                  children: [
                    _tabPill(0, 'Bildirishnomalar', provider.unreadCount, accent),
                    const SizedBox(width: 8),
                    _tabPill(1, 'Suhbatlar', context.watch<ChatProvider>().unreadTotal, accent),
                  ],
                ),
              ),
              if (_tab == 0 && provider.unreadCount > 0)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: LinearGradient(
                        colors: [
                          accent.withValues(alpha: 0.24),
                          season.glowB.withValues(alpha: 0.12),
                        ],
                      ),
                      border: Border.all(color: accent.withValues(alpha: 0.32)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.mark_email_unread_rounded, color: accent),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${season.emoji} Yangi bildirishnomalar — ${season.title.toLowerCase()} takliflari',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(height: 1.3),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 10),
              if (_tab == 0) ...[
                SizedBox(
                  height: 42,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    children: [
                      _chip('all', 'Barchasi', accent),
                      _chip('unread', 'Yangi', accent),
                      _chip('order', 'Buyurtma', accent),
                      _chip('chat', 'Suhbat', accent),
                      _chip('care', 'Shartnoma', accent),
                      _chip('offer', 'Taklif', accent),
                      _chip('bonus', 'Bonus', accent),
                      _chip('system', 'Tizim', accent),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
              ],
              Expanded(
                child: _tab == 1
                    ? _rooms(accent)
                    : provider.loading
                    ? Center(child: CircularProgressIndicator(color: accent))
                    : filtered.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.mark_email_read_outlined,
                                    size: 52, color: accent.withValues(alpha: 0.45)),
                                const SizedBox(height: 12),
                                Text(provider.error ?? 'Xabar topilmadi',
                                    textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
                                if (provider.error != null)
                                  TextButton(
                                    onPressed: () => provider.load(context.read<ApiClient>()),
                                    child: const Text('Qayta urinish'),
                                  ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            color: accent,
                            onRefresh: () => provider.load(context.read<ApiClient>()),
                            child: ListView.separated(
                              padding: EdgeInsets.fromLTRB(20, 4, 20, MediaQuery.paddingOf(context).bottom + 16),
                              itemCount: filtered.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 10),
                              itemBuilder: (_, i) {
                                final m = filtered[i];
                                final color = _typeColor(m.type, season);
                                return PressableScale(
                                  onTap: () => _openMessage(m, provider, season),
                                  child: AnimatedOpacity(
                                    duration: const Duration(milliseconds: 200),
                                    opacity: m.read ? 0.72 : 1,
                                    child: Container(
                                      padding: const EdgeInsets.all(14),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(18),
                                        gradient: LinearGradient(
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                          colors: [
                                            color.withValues(alpha: m.read ? 0.1 : 0.24),
                                            season.glowA.withValues(alpha: 0.08),
                                            AppColors.surfaceContainerHigh.withValues(alpha: 0.7),
                                          ],
                                        ),
                                        border: Border.all(
                                          color: m.read ? AppColors.glassBorder : color.withValues(alpha: 0.4),
                                        ),
                                      ),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Container(
                                            width: 48,
                                            height: 48,
                                            decoration: BoxDecoration(
                                              borderRadius: BorderRadius.circular(14),
                                              color: color.withValues(alpha: 0.2),
                                            ),
                                            child: Icon(_typeIcon(m.type), color: color),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Row(
                                                  children: [
                                                    Expanded(
                                                      child: Text(
                                                        m.title,
                                                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                                              fontWeight: m.read ? FontWeight.w600 : FontWeight.w800,
                                                              fontSize: 15,
                                                            ),
                                                      ),
                                                    ),
                                                    if (!m.read)
                                                      Container(
                                                        width: 9,
                                                        height: 9,
                                                        decoration: BoxDecoration(
                                                          color: color,
                                                          shape: BoxShape.circle,
                                                          boxShadow: [
                                                            BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 6),
                                                          ],
                                                        ),
                                                      ),
                                                  ],
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  m.body,
                                                  maxLines: 2,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                                        color: AppColors.onSurface.withValues(alpha: 0.85),
                                                        height: 1.3,
                                                        fontSize: 13,
                                                      ),
                                                ),
                                                const SizedBox(height: 10),
                                                Row(
                                                  children: [
                                                    Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                      decoration: BoxDecoration(
                                                        color: color.withValues(alpha: 0.16),
                                                        borderRadius: BorderRadius.circular(99),
                                                      ),
                                                      child: Text(
                                                        _typeLabel(m.type),
                                                        style: TextStyle(
                                                          color: color,
                                                          fontSize: 11,
                                                          fontWeight: FontWeight.w700,
                                                        ),
                                                      ),
                                                    ),
                                                    const Spacer(),
                                                    Text(
                                                      DateFormat('d MMM, HH:mm').format(m.createdAt),
                                                      style: Theme.of(context).textTheme.labelSmall?.copyWith(fontSize: 11),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tabPill(int index, String label, int badge, Color accent) {
    final active = _tab == index;
    return Expanded(
      child: PressableScale(
        onTap: () => setState(() => _tab = index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: active ? accent.withValues(alpha: 0.24) : AppColors.surfaceContainerHigh.withValues(alpha: 0.4),
            border: Border.all(color: active ? accent.withValues(alpha: 0.55) : AppColors.glassBorder),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: active ? accent : AppColors.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
              if (badge > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(99)),
                  child: Text(
                    '$badge',
                    style: const TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _rooms(Color accent) {
    final chat = context.watch<ChatProvider>();
    if (chat.roomsLoading && !chat.roomsLoaded) {
      return Center(child: CircularProgressIndicator(color: accent));
    }
    if (chat.rooms.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.forum_outlined, size: 52, color: accent.withValues(alpha: 0.45)),
              const SizedBox(height: 12),
              Text('Suhbatlar hali yo‘q', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              const Text(
                'Firma sahifasida “Yozishma” tugmasini bosing — har bir firma bilan alohida suhbat ochiladi.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.onSurfaceVariant, height: 1.4),
              ),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      color: accent,
      onRefresh: chat.loadRooms,
      child: ListView.separated(
        padding: EdgeInsets.fromLTRB(20, 4, 20, MediaQuery.paddingOf(context).bottom + 16),
        itemCount: chat.rooms.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          final r = chat.rooms[i];
          final partner = _partnerForRoom(r);
          return PressableScale(
            onTap: () => _openRoom(r),
            child: GlassCard(
              child: Row(
                children: [
                  PartnerLogo(partner: partner, size: 48),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r.firmName,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontWeight: r.unread > 0 ? FontWeight.w800 : FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          r.lastMessagePreview.isEmpty ? 'Suhbat ochildi' : r.lastMessagePreview,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (r.lastMessageAt != null)
                        Text(
                          DateUtils.isSameDay(r.lastMessageAt, DateTime.now())
                              ? DateFormat('HH:mm').format(r.lastMessageAt!)
                              : DateFormat('d MMM').format(r.lastMessageAt!),
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(fontSize: 11),
                        ),
                      if (r.unread > 0) ...[
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(99)),
                          child: Text(
                            '${r.unread}',
                            style: const TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _chip(String key, String label, Color accent) {
    final active = _filter == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: active,
        onSelected: (_) => setState(() => _filter = key),
        selectedColor: accent.withValues(alpha: 0.28),
        checkmarkColor: accent,
        labelStyle: TextStyle(
          color: active ? accent : AppColors.onSurfaceVariant,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
        side: BorderSide(color: active ? accent.withValues(alpha: 0.55) : AppColors.glassBorder),
        backgroundColor: AppColors.surfaceContainerHigh.withValues(alpha: 0.4),
      ),
    );
  }
}
