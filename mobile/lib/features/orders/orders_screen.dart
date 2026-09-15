import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/constants/service_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';
import '../home/catalog_provider.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OrdersProvider>().load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final ordersProvider = context.watch<OrdersProvider>();
    final orders = ordersProvider.orders.where((o) {
      return switch (_filter) {
        'active' =>
          o.status == 'new' ||
          o.status == 'in_review' ||
          o.status == 'contacted' ||
          o.status == 'in_progress' ||
          o.status == 'accepted',
        'done' => o.status == 'completed' || o.status == 'done',
        'cancelled' => o.status == 'cancelled',
        _ => true,
      };
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Buyurtmalarim'),
        automaticallyImplyLeading: false,
      ),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                _chip('all', 'Barchasi'),
                _chip('active', 'Faol'),
                _chip('done', 'Tugallangan'),
                _chip('cancelled', 'Bekor qilingan'),
              ],
            ),
          ),
          Expanded(
            child: ordersProvider.loading && orders.isEmpty
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : orders.isEmpty
                    ? Center(
                        child: Text(
                          'Hozircha buyurtmalar yo\'q',
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                color: AppColors.onSurfaceVariant,
                              ),
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: () => context.read<OrdersProvider>().load(),
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                          itemCount: orders.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 12),
                          itemBuilder: (_, i) {
                            final o = orders[i];
                            return GlassCard(
                              onTap: () => context.push('/order-detail', extra: o),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(8),
                                      color: AppColors.secondaryContainer.withValues(alpha: 0.3),
                                    ),
                                    child: const Icon(Icons.receipt_long, color: AppColors.secondary),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Expanded(
                                              child: Text(
                                                o.serviceName,
                                                style: Theme.of(context).textTheme.titleMedium,
                                              ),
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: AppColors.primary.withValues(alpha: 0.12),
                                                borderRadius: BorderRadius.circular(999),
                                              ),
                                              child: Text(
                                                '${statusEmoji(o.status)} ${o.statusLabel}',
                                                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                                      color: AppColors.primary,
                                                    ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          DateFormat('d MMMM yyyy').format(o.createdAt),
                                          style: Theme.of(context).textTheme.labelSmall,
                                        ),
                                        const SizedBox(height: 10),
                                        GrowthProgressBar(progress: o.progress),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String key, String label) {
    final active = _filter == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: active,
        onSelected: (_) => setState(() => _filter = key),
        selectedColor: AppColors.primary,
        labelStyle: TextStyle(
          color: active ? AppColors.onPrimary : AppColors.onSurfaceVariant,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
        backgroundColor: AppColors.glass,
        side: BorderSide(color: active ? AppColors.primary : AppColors.glassBorder),
        showCheckmark: false,
      ),
    );
  }
}
