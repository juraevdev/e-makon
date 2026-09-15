import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';

class OrderSuccessScreen extends StatelessWidget {
  const OrderSuccessScreen({super.key, required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              const Spacer(),
              Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 128,
                    height: 128,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.primary.withValues(alpha: 0.2),
                    ),
                  ),
                  Container(
                    width: 112,
                    height: 112,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.primary,
                    ),
                    child: const Icon(Icons.check, size: 56, color: AppColors.onPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              Text(
                'Buyurtmangiz qabul qilindi!',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: 12),
              Text(
                "Rahmat! Siz bilan tez orada mutaxassislarimiz bog'lanishadi",
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 32),
              GlassCard(
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'XIZMAT MA\'LUMOTLARI',
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                        const Icon(Icons.verified, color: AppColors.primary, size: 18),
                      ],
                    ),
                    const Divider(height: 24, color: AppColors.outlineVariant),
                    _row('Xizmat turi', order.serviceName),
                    _row('Maydon', order.areaSize.isEmpty ? '—' : order.areaSize),
                    _row('Sana', DateFormat('d MMMM yyyy', 'en').format(order.createdAt)),
                    _row('Buyurtma №', '#${order.id}'),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.tertiaryContainer.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.tertiaryContainer.withValues(alpha: 0.2)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.notifications_active, size: 18, color: AppColors.tertiary),
                    SizedBox(width: 8),
                    Text('Sizga SMS xabar yuborildi', style: TextStyle(color: AppColors.tertiary, fontSize: 12)),
                  ],
                ),
              ),
              const Spacer(),
              PrimaryButton(
                label: 'Bosh sahifaga qaytish',
                icon: Icons.home,
                onPressed: () => context.go('/home'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => context.go('/orders'),
                child: const Text('Buyurtmani kuzatish', style: TextStyle(color: AppColors.primary)),
              ),
              const SizedBox(height: 24),
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
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k, style: const TextStyle(color: AppColors.onSurfaceVariant)),
          Flexible(child: Text(v, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
