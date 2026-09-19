import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'app_image.dart';

/// Kreativ gradient xizmat ikonkasi — rasm bo‘lsa rasmini ko‘rsatadi.
class ServiceBadgeIcon extends StatelessWidget {
  const ServiceBadgeIcon({
    super.key,
    required this.iconKey,
    required this.accent,
    this.size = 56,
    this.emoji,
    this.image = '',
  });

  final String iconKey;
  final Color accent;
  final double size;
  final String? emoji;
  final String image;

  IconData get _icon => switch (iconKey) {
        'call' => Icons.headset_mic_rounded,
        'architecture' => Icons.architecture_rounded,
        'eco' => Icons.forest_rounded,
        'content_cut' => Icons.content_cut_rounded,
        'park' => Icons.park_rounded,
        'science' => Icons.science_rounded,
        'database' => Icons.spa_rounded,
        'verified_user' => Icons.verified_rounded,
        'water_drop' => Icons.water_drop_rounded,
        _ => Icons.yard_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(size * 0.28);
    if (image.isNotEmpty) {
      return ClipRRect(
        borderRadius: radius,
        child: SizedBox(
          width: size,
          height: size,
          child: AppImage(
            path: image,
            fallback: _iconFallback(),
          ),
        ),
      );
    }
    return _iconFallback();
  }

  Widget _iconFallback() {
    return SizedBox(
      width: size,
      height: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(size * 0.28),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              accent.withValues(alpha: 0.95),
              accent.withValues(alpha: 0.55),
              AppColors.surfaceContainerHigh,
            ],
          ),
          boxShadow: [
            BoxShadow(
              color: accent.withValues(alpha: 0.35),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              right: -size * 0.15,
              bottom: -size * 0.15,
              child: Icon(_icon, size: size * 0.7, color: Colors.white.withValues(alpha: 0.12)),
            ),
            if (emoji != null && emoji!.isNotEmpty)
              Text(emoji!, style: TextStyle(fontSize: size * 0.38))
            else
              Icon(_icon, size: size * 0.42, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

class ServerOfflineBanner extends StatelessWidget {
  const ServerOfflineBanner({super.key, this.message, this.onRetry});

  final String? message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0x33FF9800),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x66FFB74D)),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, color: Color(0xFFFFB74D)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message ?? 'Serverga ulanmagan — ma’lumotlar ko‘rsatilmaydi',
              style: const TextStyle(color: Color(0xFFFFE0B2), fontSize: 13, height: 1.3),
            ),
          ),
          if (onRetry != null)
            TextButton(
              onPressed: onRetry,
              child: const Text('Qayta', style: TextStyle(color: Color(0xFFFFB74D))),
            ),
        ],
      ),
    );
  }
}
