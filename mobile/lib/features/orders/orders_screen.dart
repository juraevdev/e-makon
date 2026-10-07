import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/season_theme.dart';
import '../../core/utils/live_refresh.dart';
import '../../core/widgets/motion.dart';
import '../../core/widgets/widgets.dart';
import '../home/catalog_provider.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> with LiveRefresh {
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OrdersProvider>().load();
    });
  }

  /// Firma/superadmin o'zgartirgan holat tez ko'rinsin.
  @override
  Duration get liveInterval => const Duration(seconds: 5);

  @override
  Future<void> liveRefresh() => context.read<OrdersProvider>().load(silent: true);

  Color _statusColor(String status, SeasonTheme season) => switch (status) {
        'completed' || 'done' => season.accent,
        'cancelled' => AppColors.error,
        'contacted' || 'on_way' || 'arrived' => season.accentSoft,
        'in_review' || 'accepted' || 'in_progress' => Color.lerp(season.accent, const Color(0xFFFFB74D), 0.45)!,
        _ => season.accent,
      };

  IconData _statusIcon(String status) => switch (status) {
        'completed' || 'done' => Icons.verified_rounded,
        'cancelled' => Icons.cancel_outlined,
        'contacted' => Icons.phone_in_talk_outlined,
        'in_review' || 'accepted' || 'in_progress' => Icons.hourglass_top_rounded,
        _ => Icons.receipt_long_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final ordersProvider = context.watch<OrdersProvider>();
    final all = ordersProvider.orders;
    final activeCount = all.where((o) => o.isActive).length;
    final doneCount = all.where((o) => o.isCompleted).length;
    final orders = all.where((o) {
      return switch (_filter) {
        'active' => o.isActive,
        'done' => o.isCompleted,
        'cancelled' => o.isCancelled,
        _ => true,
      };
    }).toList();
    final season = SeasonTheme.of();
    final accent = season.accent;

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
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
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
                            'Buyurtmalar',
                            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 26,
                                ),
                          ),
                          Text(
                            'Holatni jonli kuzating',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: season.accentSoft.withValues(alpha: 0.9),
                                ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => context.read<OrdersProvider>().load(),
                      style: IconButton.styleFrom(
                        backgroundColor: accent.withValues(alpha: 0.14),
                      ),
                      icon: Icon(Icons.refresh_rounded, color: accent),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                child: Row(
                  children: [
                    Expanded(child: _StatPill(label: 'Jami', value: '${all.length}', color: accent)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _StatPill(
                        label: 'Faol',
                        value: '$activeCount',
                        color: Color.lerp(accent, const Color(0xFFFFB74D), 0.4)!,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: _StatPill(label: 'Tugagan', value: '$doneCount', color: season.accentSoft)),
                  ],
                ),
              ),
              SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  children: [
                    _chip('all', 'Barchasi', all.length, accent),
                    _chip('active', 'Faol', activeCount, accent),
                    _chip('done', 'Tugallangan', doneCount, accent),
                    _chip('cancelled', 'Bekor', all.where((o) => o.status == 'cancelled').length, accent),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: ordersProvider.loading && orders.isEmpty
                    ? Center(child: CircularProgressIndicator(color: accent))
                    : ordersProvider.error != null && all.isEmpty
                        ? _LoadError(
                            message: ordersProvider.error!,
                            accent: accent,
                            onRetry: () => context.read<OrdersProvider>().load(),
                          )
                    : orders.isEmpty
                        ? RefreshIndicator(
                            color: accent,
                            onRefresh: () => context.read<OrdersProvider>().load(),
                            child: LayoutBuilder(
                              builder: (_, box) => SingleChildScrollView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                child: ConstrainedBox(
                                  constraints: BoxConstraints(minHeight: box.maxHeight),
                                  child: _EmptyOrders(onBrowse: () => context.go('/home'), accent: accent),
                                ),
                              ),
                            ),
                          )
                        : RefreshIndicator(
                            color: accent,
                            onRefresh: () => context.read<OrdersProvider>().load(),
                            child: ListView.separated(
                              padding: EdgeInsets.fromLTRB(20, 4, 20, MediaQuery.paddingOf(context).bottom + 16),
                              itemCount: orders.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 12),
                              itemBuilder: (_, i) => _OrderCard(
                                order: orders[i],
                                statusColor: _statusColor(orders[i].status, season),
                                statusIcon: _statusIcon(orders[i].status),
                                seasonGlow: season.glowA,
                                onTap: () => context.push('/order-detail', extra: orders[i]),
                              ),
                            ),
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(String key, String label, int count, Color accent) {
    final active = _filter == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text('$label · $count'),
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

class _StatPill extends StatelessWidget {
  const _StatPill({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color.withValues(alpha: 0.22), AppColors.surfaceContainerHigh.withValues(alpha: 0.5)],
        ),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 20)),
          Text(label, style: Theme.of(context).textTheme.labelSmall),
        ],
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({
    required this.order,
    required this.statusColor,
    required this.statusIcon,
    required this.seasonGlow,
    required this.onTap,
  });

  final OrderModel order;
  final Color statusColor;
  final IconData statusIcon;
  final Color seasonGlow;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              statusColor.withValues(alpha: 0.22),
              seasonGlow.withValues(alpha: 0.12),
              AppColors.surfaceContainerHigh.withValues(alpha: 0.75),
            ],
          ),
          border: Border.all(color: statusColor.withValues(alpha: 0.32)),
          boxShadow: [
            BoxShadow(color: statusColor.withValues(alpha: 0.14), blurRadius: 16, offset: const Offset(0, 8)),
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: statusColor.withValues(alpha: 0.2),
                  ),
                  child: Icon(statusIcon, color: statusColor),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.serviceName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        '#${order.receiptCode.isEmpty ? order.id : order.receiptCode}',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    order.displayStatus,
                    style: TextStyle(color: statusColor, fontWeight: FontWeight.w700, fontSize: 11),
                  ),
                ),
              ],
            ),
            if (order.address.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.place_outlined, size: 16, color: AppColors.onSurfaceVariant),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(order.address, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall),
                  ),
                ],
              ),
            ],
            if (order.needsPayment || order.isPaymentChecking) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(
                    order.isPaymentChecking ? Icons.hourglass_top_rounded : Icons.payments_outlined,
                    size: 16,
                    color: order.paymentStatus == 'rejected' ? AppColors.error : AppColors.primary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    order.paymentLabel,
                    style: TextStyle(
                      color: order.paymentStatus == 'rejected' ? AppColors.error : AppColors.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            GrowthProgressBar(progress: order.progress),
            const SizedBox(height: 10),
            Row(
              children: [
                Text(
                  DateFormat('d MMM, HH:mm').format(order.createdAt),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(fontSize: 11),
                ),
                if (order.scheduledDate != null || order.timeSlot.isNotEmpty) ...[
                  const Text(' · ', style: TextStyle(color: AppColors.onSurfaceVariant)),
                  Icon(Icons.event_outlined, size: 13, color: statusColor),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      [
                        if (order.scheduledDate != null) DateFormat('d MMM').format(order.scheduledDate!),
                        if (order.timeSlot.isNotEmpty) order.timeSlot,
                      ].join(' '),
                      style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
                const Spacer(),
                if (order.amount > 0)
                  Text(
                    '${ServiceModel.formatMoney(order.amount)} so‘m',
                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 12),
                  ),
                const SizedBox(width: 4),
                Icon(Icons.chevron_right_rounded, color: statusColor, size: 20),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.message, required this.accent, required this.onRetry});
  final String message;
  final Color accent;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded, size: 52, color: accent.withValues(alpha: 0.55)),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Qayta urinish'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyOrders extends StatelessWidget {
  const _EmptyOrders({required this.onBrowse, required this.accent});
  final VoidCallback onBrowse;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accent.withValues(alpha: 0.14),
              ),
              child: Icon(Icons.receipt_long_rounded, size: 40, color: accent),
            ),
            const SizedBox(height: 16),
            Text('Hali buyurtma yo‘q', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(
              'Xizmat tanlang va birinchi buyurtmangizni bering',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: 18),
            PrimaryButton(label: 'Xizmat tanlash', icon: Icons.grid_view_rounded, onPressed: onBrowse, roundedFull: true),
          ],
        ),
      ),
    );
  }
}
