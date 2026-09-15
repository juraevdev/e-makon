import 'dart:io';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/theme/app_colors.dart';

class GlassBottomBar extends StatelessWidget {
  const GlassBottomBar({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          decoration: BoxDecoration(
            color: AppColors.darkBg.withValues(alpha: 0.72),
            border: Border(
              top: BorderSide(
                color: AppColors.accentGreen.withValues(alpha: 0.2),
              ),
            ),
          ),
          child: SafeArea(top: false, child: child),
        ),
      ),
    );
  }
}

class GlassActionButton extends StatelessWidget {
  const GlassActionButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.enabled = true,
    this.expanded = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool enabled;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final button = Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onPressed : null,
        borderRadius: BorderRadius.circular(28),
        child: Ink(
          height: 54,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            color: AppColors.accentGreen.withValues(alpha: enabled ? 0.18 : 0.08),
            border: Border.all(
              color: AppColors.accentGreen.withValues(alpha: enabled ? 0.55 : 0.2),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  size: 20,
                  color: enabled ? AppColors.mintGreen : AppColors.darkMuted,
                ),
                const SizedBox(width: 8),
              ],
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: enabled ? AppColors.mintGreen : AppColors.darkMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (!expanded) return button;
    return SizedBox(width: double.infinity, child: button);
  }
}

class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    this.avatarPath,
    this.radius = 22,
    this.fallbackUrl,
  });

  final String? avatarPath;
  final double radius;
  final String? fallbackUrl;

  @override
  Widget build(BuildContext context) {
    ImageProvider? image;
    if (avatarPath != null && avatarPath!.isNotEmpty) {
      image = FileImage(File(avatarPath!));
    } else if (fallbackUrl != null) {
      image = NetworkImage(fallbackUrl!);
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.darkSurface,
      backgroundImage: image,
      child: image == null
          ? Icon(Icons.person, color: AppColors.mintGreen, size: radius)
          : null,
    );
  }
}
