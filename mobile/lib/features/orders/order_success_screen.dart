import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';

/// Elektron tasdiqlash cheki — ish tugaguncha saqlanadi.
class OrderSuccessScreen extends StatelessWidget {
  const OrderSuccessScreen({super.key, required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context) {
    final active = order.status != 'done' && order.status != 'cancelled';

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              const SizedBox(height: 24),
              Text('Elektron chek', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                active ? 'Ish yakunlanguncha chek saqlanadi' : 'Buyurtma yakunlangan',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AppColors.primary),
              ),
              const SizedBox(height: 20),
              Expanded(
                child: GlassCard(
                  borderRadius: 18,
                  child: ListView(
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.receipt_long, color: AppColors.primary),
                          const SizedBox(width: 8),
                          Text(order.receiptCode.isEmpty ? 'EM-${order.id}' : order.receiptCode,
                              style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1)),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text(order.statusLabel, style: const TextStyle(color: AppColors.primary, fontSize: 12)),
                          ),
                        ],
                      ),
                      const Divider(height: 28),
                      _row('Sana', DateFormat('d MMMM yyyy, HH:mm').format(order.createdAt)),
                      _row('Firma', order.partnerName.isEmpty ? '—' : order.partnerName),
                      _row('Manzil', order.address.isEmpty ? '—' : order.address),
                      _row('Maydon', order.areaSize.isEmpty ? '—' : '${order.areaSize} m²'),
                      if (order.notes.isNotEmpty) _row('Izoh', order.notes),
                      const SizedBox(height: 8),
                      Text('Xizmatlar', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 6),
                      for (final s in order.allServices)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle, size: 16, color: AppColors.primary),
                              const SizedBox(width: 8),
                              Expanded(child: Text(s)),
                            ],
                          ),
                        ),
                      const Divider(height: 28),
                      _row(
                        'Summa',
                        order.amount > 0 ? '${ServiceModel.formatMoney(order.amount)} so‘m' : '—',
                      ),
                      if (order.pointsEarned > 0) _row('Ball', '+${order.pointsEarned}'),
                      const SizedBox(height: 12),
                      GrowthProgressBar(progress: order.progress),
                      const SizedBox(height: 8),
                      Text(
                        'Qabul → Yo‘l → Yetib keldi → Tugadi',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              PrimaryButton(
                label: 'Buyurtmani kuzatish',
                icon: Icons.timeline,
                onPressed: () => context.push('/order-detail', extra: order),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => context.go('/home'),
                child: const Text('Bosh sahifa', style: TextStyle(color: AppColors.primary)),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 88, child: Text(k, style: const TextStyle(color: AppColors.onSurfaceVariant))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
