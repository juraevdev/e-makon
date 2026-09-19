import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

IconData serviceIcon(String name) {
  return switch (name) {
    'call' => Icons.call,
    'architecture' => Icons.architecture,
    'eco' => Icons.eco,
    'content_cut' => Icons.content_cut,
    'park' => Icons.park,
    'science' => Icons.science,
    'database' => Icons.spa,
    'verified_user' => Icons.verified_user,
    'water_drop' => Icons.water_drop,
    'local_florist' => Icons.local_florist,
    'info' => Icons.info_outline,
    'photo_library' => Icons.photo_library_outlined,
    _ => Icons.eco,
  };
}

Color serviceTint(int index) {
  const colors = [
    AppColors.primary,
    AppColors.secondary,
    AppColors.tertiary,
    AppColors.primary,
    AppColors.secondary,
    AppColors.error,
    AppColors.tertiary,
    AppColors.primary,
    AppColors.secondary,
  ];
  return colors[index % colors.length];
}

String statusEmoji(String status) => switch (status) {
      'new' => '🆕',
      'accepted' => '✅',
      'on_way' => '🚗',
      'arrived' => '📍',
      'in_progress' => '⏳',
      'done' => '✔️',
      'cancelled' => '✕',
      _ => '•',
    };
