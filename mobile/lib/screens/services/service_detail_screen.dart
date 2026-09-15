import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../data/services_data.dart';
import '../../models/service.dart';
import '../../widgets/glass_button.dart';
import '../order/order_flow_screen.dart';

class ServiceDetailScreen extends StatelessWidget {
  const ServiceDetailScreen({super.key, required this.serviceId});

  final String serviceId;

  @override
  Widget build(BuildContext context) {
    final service = findServiceById(serviceId);
    if (service == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Xizmat topilmadi')),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              _buildHero(context, service),
              SliverToBoxAdapter(child: _buildContent(context, service)),
              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
          _buildBottomButton(context, service),
        ],
      ),
    );
  }

  Widget _buildHero(BuildContext context, GardenService service) {
    final imageUrl = service.heroImageUrl ??
        'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800';

    return SliverAppBar(
      expandedHeight: 260,
      pinned: true,
      backgroundColor: AppColors.darkBg,
      leading: Padding(
        padding: const EdgeInsets.all(8),
        child: CircleAvatar(
          backgroundColor: Colors.black.withValues(alpha: 0.4),
          child: IconButton(
            icon: const Icon(Icons.arrow_back, color: AppColors.white),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
      ),
      flexibleSpace: FlexibleSpaceBar(
        background: ClipRRect(
          borderRadius: const BorderRadius.only(
            bottomLeft: Radius.circular(24),
            bottomRight: Radius.circular(24),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: AppColors.darkSurface,
                  child: Icon(service.icon, size: 64, color: AppColors.mintGreen),
                ),
              ),
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      AppColors.darkBg.withValues(alpha: 0.8),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, GardenService service) {
    final features = service.features.isNotEmpty
        ? service.features
        : const [
            ServiceFeature(icon: Icons.verified_outlined, label: 'Kafolat'),
            ServiceFeature(icon: Icons.eco_outlined, label: 'Sifatli xizmat'),
            ServiceFeature(icon: Icons.groups_outlined, label: 'Ekspertlar'),
            ServiceFeature(icon: Icons.schedule_outlined, label: 'Tezkorlik'),
          ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            service.name,
            style: GoogleFonts.inter(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: AppColors.darkText,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            service.detailDescription,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.mintGreen.withValues(alpha: 0.85),
              height: 1.6,
            ),
          ),
          const SizedBox(height: 24),
          _infoCard(
            label: AppStrings.servicePrice,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.accentGreen.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                service.priceLabel,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.mintGreen,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          _infoCard(
            label: '',
            showLabel: false,
            child: Row(
              children: [
                Icon(Icons.access_time, size: 20, color: AppColors.mintGreen),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    service.duration,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AppColors.darkText,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Text(
            AppStrings.whyChooseUs,
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.darkText,
            ),
          ),
          const SizedBox(height: 14),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 2.4,
            children: features.map((f) => _featureCard(f)).toList(),
          ),
          if (service.galleryImages.isNotEmpty) ...[
            const SizedBox(height: 28),
            Text(
              AppStrings.processImages,
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.darkText,
              ),
            ),
            const SizedBox(height: 14),
            _buildGallery(service.galleryImages),
          ],
        ],
      ),
    );
  }

  Widget _infoCard({
    required String label,
    required Widget child,
    bool showLabel = true,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.darkBorder),
      ),
      child: showLabel
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: AppColors.darkMuted,
                  ),
                ),
                const SizedBox(height: 8),
                child,
              ],
            )
          : child,
    );
  }

  Widget _featureCard(ServiceFeature feature) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.darkSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.darkBorder),
      ),
      child: Row(
        children: [
          Icon(feature.icon, color: AppColors.mintGreen, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              feature.label,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.darkText,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGallery(List<String> images) {
    if (images.length < 3) {
      return SizedBox(
        height: 200,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: images.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (_, i) => _galleryImage(images[i], width: 160, height: 200),
        ),
      );
    }

    return SizedBox(
      height: 220,
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: _galleryImage(images[0], height: 220),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: Column(
              children: [
                Expanded(child: _galleryImage(images[1])),
                const SizedBox(height: 10),
                Expanded(child: _galleryImage(images[2])),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _galleryImage(String url, {double? width, double? height}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Image.network(
        url,
        width: width,
        height: height,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Container(
          color: AppColors.darkSurface,
          child: const Icon(Icons.image_outlined, color: AppColors.darkMuted),
        ),
      ),
    );
  }

  Widget _buildBottomButton(BuildContext context, GardenService service) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: GlassBottomBar(
        child: GlassActionButton(
          label: AppStrings.placeOrder,
          icon: Icons.shopping_cart_outlined,
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) =>
                    OrderFlowScreen(preselectedServiceId: service.id),
              ),
            );
          },
        ),
      ),
    );
  }
}
