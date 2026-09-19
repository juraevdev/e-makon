import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/price_calculator.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/service_badge_icon.dart';
import '../../core/widgets/widgets.dart';
import '../favorites/favorites_provider.dart';
import 'catalog_provider.dart';

class ServiceDetailScreen extends StatefulWidget {
  const ServiceDetailScreen({super.key, required this.slug});

  final String slug;

  @override
  State<ServiceDetailScreen> createState() => _ServiceDetailScreenState();
}

class _ServiceDetailScreenState extends State<ServiceDetailScreen> {
  double _area = 100;

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final service = catalog.bySlug(widget.slug);
    final favs = context.watch<FavoritesProvider>();

    if (service == null) {
      return Scaffold(
        appBar: AppBar(leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Xizmat topilmadi',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.onSurfaceVariant),
            ),
          ),
        ),
      );
    }

    final estimate = PriceCalculator.estimateForService(service, _area);

    return Scaffold(
      appBar: AppBar(
        title: Text(service.name),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          IconButton(
            onPressed: () => favs.toggleService(service.id),
            icon: Icon(
              favs.isServiceFav(service.id) ? Icons.favorite : Icons.favorite_border,
              color: favs.isServiceFav(service.id) ? Colors.redAccent : null,
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
        children: [
          if (service.hasImage)
            ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: AspectRatio(
                aspectRatio: 16 / 10,
                child: AppImage(
                  path: service.image,
                  fallback: ColoredBox(color: Color(service.accent).withValues(alpha: 0.35)),
                ),
              ),
            )
          else
            Center(
              child: ServiceBadgeIcon(
                iconKey: service.icon,
                accent: Color(service.accent),
                size: 96,
                emoji: service.emoji,
                image: service.image,
              ),
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
                const SizedBox(height: 8),
                Text(
                  service.priceLabel,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: AppColors.primary,
                        fontSize: 22,
                      ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Diapazon — maydon bo‘yicha aniqroq hisoblang',
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Narx kalkulyatori', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text('Maydon: ${_area.toStringAsFixed(0)} m²', style: Theme.of(context).textTheme.labelSmall),
                Slider(
                  value: _area,
                  min: 20,
                  max: 1000,
                  divisions: 98,
                  activeColor: AppColors.primary,
                  onChanged: (v) => setState(() => _area = v),
                ),
                Text(
                  'Taxminiy: ${PriceCalculator.label(estimate)}',
                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary, fontSize: 18),
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
                    Text("O'rtacha vaqt", style: Theme.of(context).textTheme.labelSmall),
                    Text('1.5 - 3 soat', style: Theme.of(context).textTheme.labelLarge),
                  ],
                ),
              ],
            ),
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
