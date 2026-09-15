import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

IconData serviceIcon(String name) {
  return switch (name) {
    'call' || 'phone_in_talk' => Icons.call,
    'architecture' => Icons.architecture,
    'eco' => Icons.eco,
    'content_cut' => Icons.content_cut,
    'park' || 'forest' => Icons.park,
    'science' => Icons.science,
    'database' || 'grain' => Icons.spa,
    'verified_user' => Icons.verified_user,
    'water_drop' => Icons.water_drop,
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
      'in_review' || 'in_progress' => '⏳',
      'contacted' || 'accepted' => '✅',
      'completed' || 'done' => '✔️',
      'cancelled' => '✕',
      _ => '•',
    };
