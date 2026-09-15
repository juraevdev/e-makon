import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/constants/service_icons.dart';
import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';
import 'catalog_provider.dart';

class ServiceDetailScreen extends StatelessWidget {
  const ServiceDetailScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final service = catalog.bySlug(slug) ??
        ServiceModel.fallback.firstWhere(
          (s) => s.slug == slug,
          orElse: () => ServiceModel.fallback.first,
        );

    return Scaffold(
      appBar: AppBar(
        title: Text(service.name),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
        children: [
          GlassCard(
            borderRadius: 20,
            padding: const EdgeInsets.all(32),
            child: Icon(serviceIcon(service.icon), size: 72, color: AppColors.primary),
          ),
          const SizedBox(height: 24),
          Text(service.name, style: Theme.of(context).textTheme.headlineLarge),
          const SizedBox(height: 12),
          Text(
            service.description.isNotEmpty ? service.description : service.shortDescription,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.onSurfaceVariant,
                  height: 1.5,
                ),
          ),
          const SizedBox(height: 24),
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Xizmat narxi', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.secondaryContainer.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    'Kelishilgan narxda',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: AppColors.onSecondaryContainer,
                        ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          GlassCard(
            child: Row(
              children: [
                const Icon(Icons.timer, color: AppColors.primary),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "O'rtacha vaqt",
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                    Text('1.5 - 3 soat', style: Theme.of(context).textTheme.labelLarge),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Text("Nega bizni tanlashadi?", style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.4,
            children: const [
              _Feature(Icons.verified_user, 'Kafolat'),
              _Feature(Icons.health_and_safety, 'Xavfsiz dori'),
              _Feature(Icons.engineering, 'Ekspertlar'),
              _Feature(Icons.event_available, 'Tezkorlik'),
            ],
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: ElevatedButton(
            onPressed: () => context.push('/order', extra: service),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppColors.primaryContainer,
              shape: const StadiumBorder(),
              minimumSize: const Size.fromHeight(56),
            ),
            child: const Text('Buyurtma berish'),
          ),
        ),
      ),
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature(this.icon, this.label);
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: AppColors.primary),
          const SizedBox(height: 8),
          Text(label, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.onSurface)),
        ],
      ),
    );
  }
}
