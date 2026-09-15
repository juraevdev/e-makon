import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/theme/app_colors.dart';
import '../models/service.dart';

class ServiceCard extends StatelessWidget {
  const ServiceCard({
    super.key,
    required this.service,
    this.onTap,
    this.compact = false,
    this.grid = false,
  });

  final GardenService service;
  final VoidCallback? onTap;
  final bool compact;
  final bool grid;

  @override
  Widget build(BuildContext context) {
    if (grid) return _buildGridCard();

    return Material(
      color: AppColors.darkSurface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: EdgeInsets.all(compact ? 12 : 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.darkBorder),
          ),
          child: compact ? _buildCompact() : _buildFull(),
        ),
      ),
    );
  }

  Widget _buildGridCard() {
    return Material(
      color: AppColors.darkSurface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.darkBorder),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.darkCard,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.accentGreen.withValues(alpha: 0.3),
                  ),
                ),
                child: Icon(
                  service.icon,
                  color: AppColors.mintGreen,
                  size: 22,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                service.name,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w500,
                  fontSize: 11,
                  color: AppColors.darkText,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCompact() {
    return Row(
      children: [
        _iconBox(44),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                service.name,
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: AppColors.darkText,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                service.category,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: AppColors.darkMuted,
                ),
              ),
            ],
          ),
        ),
        const Icon(Icons.chevron_right, color: AppColors.darkMuted, size: 20),
      ],
    );
  }

  Widget _buildFull() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _iconBox(52),
        const SizedBox(height: 12),
        Text(
          service.name,
          style: GoogleFonts.inter(
            fontWeight: FontWeight.w600,
            fontSize: 15,
            color: AppColors.darkText,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          service.description,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: GoogleFonts.inter(
            fontSize: 13,
            color: AppColors.darkMuted,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.accentGreen.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            service.category,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: AppColors.mintGreen,
            ),
          ),
        ),
      ],
    );
  }

  Widget _iconBox(double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: AppColors.cardGradient,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(service.icon, color: AppColors.white, size: size * 0.5),
    );
  }
}
