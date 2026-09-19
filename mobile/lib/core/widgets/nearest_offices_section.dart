import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../theme/app_colors.dart';
import 'partner_sheet.dart';
import 'widgets.dart';
import '../../features/home/catalog_provider.dart';

class NearestOfficesSection extends StatelessWidget {
  const NearestOfficesSection({super.key});

  @override
  Widget build(BuildContext context) {
    final feed = context.watch<HomeFeedProvider>();
    final nearest = feed.nearestPartners;

    if (nearest.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(horizontal: 20),
        child: Text('Yaqin markazlar topilmadi', style: TextStyle(color: AppColors.onSurfaceVariant)),
      );
    }

    final center = feed.userLat != null
        ? LatLng(feed.userLat!, feed.userLng!)
        : LatLng(nearest.first.lat, nearest.first.lng);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Row(
            children: [
              Expanded(
                child: Text('Yaqin ofislar', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 22)),
              ),
              TextButton.icon(
                onPressed: () => feed.refreshLocation(),
                icon: const Icon(Icons.my_location, size: 16, color: AppColors.primary),
                label: const Text('Lokatsiya', style: TextStyle(color: AppColors.primary)),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: SizedBox(
              height: 220,
              child: FlutterMap(
                options: MapOptions(
                  initialCenter: center,
                  initialZoom: 12.2,
                ),
                children: [
                  TileLayer(
                    // Carto — OSM public tile usage warning’ini oldini oladi
                    urlTemplate: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                    subdomains: const ['a', 'b', 'c', 'd'],
                    userAgentPackageName: 'uz.emakon.emakon_app',
                  ),
                  if (feed.userLat != null)
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: LatLng(feed.userLat!, feed.userLng!),
                          width: 40,
                          height: 40,
                          child: const Icon(Icons.person_pin_circle, color: Colors.blueAccent, size: 36),
                        ),
                      ],
                    ),
                  MarkerLayer(
                    markers: [
                      for (final p in nearest)
                        Marker(
                          point: LatLng(p.lat, p.lng),
                          width: 44,
                          height: 44,
                          child: GestureDetector(
                            onTap: () {
                              final d = feed.distanceKm(p);
                              showPartnerSheet(context, p, distanceKm: d >= 0 ? d : null);
                            },
                            child: const Icon(Icons.location_on, color: AppColors.primary, size: 40),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        ...nearest.map((p) {
          final d = feed.distanceKm(p);
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
            child: GlassCard(
              borderRadius: 14,
              onTap: () async {
                await showPartnerSheet(context, p, distanceKm: d >= 0 ? d : null);
              },
              child: Row(
                children: [
                  PartnerLogo(partner: p, size: 48),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p.name, style: Theme.of(context).textTheme.titleMedium),
                        Text(p.activity.isEmpty ? p.tagline : p.activity, style: Theme.of(context).textTheme.labelSmall),
                        Text(
                          d >= 0 ? '${d.toStringAsFixed(1)} km · ${p.address}' : p.address,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Navigator',
                    onPressed: () => openNavigator(p.lat, p.lng, label: p.name),
                    icon: const Icon(Icons.directions, color: AppColors.primary),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}
