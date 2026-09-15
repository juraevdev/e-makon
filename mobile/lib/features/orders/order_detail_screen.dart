import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';

class OrderDetailScreen extends StatelessWidget {
  const OrderDetailScreen({super.key, required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context) {
    final steps = [
      ('Yangi', order.progress >= 0.22),
      ('Kelishilmoqda', order.progress >= 0.48),
      ("Bog'lanildi", order.progress >= 0.72),
      ('Bajarildi', order.progress >= 1.0 && order.status != 'cancelled'),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text('Buyurtma #${order.id}'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(order.serviceName, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 20)),
                const SizedBox(height: 8),
                Text(
                  order.statusLabel,
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 16),
                GrowthProgressBar(progress: order.progress),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text('Kuzatuv', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...List.generate(steps.length, (i) {
            final (label, done) = steps[i];
            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Row(
                children: [
                  Icon(
                    done ? Icons.check_circle : Icons.radio_button_unchecked,
                    color: done ? AppColors.primary : AppColors.outlineVariant,
                  ),
                  const SizedBox(width: 12),
                  Text(
                    label,
                    style: TextStyle(
                      color: done ? AppColors.onSurface : AppColors.onSurfaceVariant,
                      fontWeight: done ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 12),
          GlassCard(
            child: Column(
              children: [
                _row('Sana', DateFormat('d MMM yyyy, HH:mm').format(order.createdAt)),
                _row('Maydon', order.areaSize.isEmpty ? '—' : order.areaSize),
                _row('Manzil', order.address.isEmpty ? '—' : order.address),
                _row('Telefon', order.phoneNumber.isEmpty ? '—' : order.phoneNumber),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 90, child: Text(k, style: const TextStyle(color: AppColors.onSurfaceVariant))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w500))),
        ],
      ),
    );
  }
}
