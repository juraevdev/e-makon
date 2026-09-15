import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../models/order.dart';
import '../../widgets/falling_leaves_animation.dart';
import '../shell/main_shell.dart';

class OrderSuccessScreen extends StatelessWidget {
  const OrderSuccessScreen({super.key, required this.order});

  final GardenOrder order;

  @override
  Widget build(BuildContext context) {
    final areaText = order.area.isNotEmpty ? order.area : '60 sotix';

    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: LeafRainBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const Spacer(flex: 2),
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    color: AppColors.mintGreen.withValues(alpha: 0.25),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check,
                    color: AppColors.accentGreen,
                    size: 44,
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  AppStrings.orderAcceptedTitle,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: AppColors.darkText,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  AppStrings.orderAcceptedSubtitle,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppColors.darkMuted,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 32),
                _buildDetailsCard(areaText),
                const SizedBox(height: 20),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.accentGreen.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: AppColors.accentGreen.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.notifications_active_outlined,
                        size: 18,
                        color: AppColors.mintGreen.withValues(alpha: 0.9),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        AppStrings.smsSent,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AppColors.mintGreen,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(flex: 3),
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (_) => const MainShell()),
                        (_) => false,
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accentGreen,
                      foregroundColor: AppColors.darkBg,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    icon: const Icon(Icons.home_outlined, size: 20),
                    label: Text(
                      AppStrings.backToHome,
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDetailsCard(String areaText) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.darkSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.darkBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                AppStrings.serviceInfo.toUpperCase(),
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.darkMuted,
                  letterSpacing: 1.2,
                ),
              ),
              Icon(
                Icons.local_florist_outlined,
                size: 18,
                color: AppColors.darkMuted.withValues(alpha: 0.5),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _detailRow(AppStrings.serviceType, order.serviceName),
          const SizedBox(height: 12),
          _detailRow(AppStrings.areaLabel, areaText),
          const SizedBox(height: 12),
          _detailRow(
            AppStrings.dateLabel,
            _formatDate(order.createdAt),
          ),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 2,
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.darkMuted,
            ),
          ),
        ),
        Expanded(
          flex: 3,
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.darkText,
            ),
          ),
        ),
      ],
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    if (date.year == now.year &&
        date.month == now.month &&
        date.day == now.day) {
      return AppStrings.today;
    }
    return DateFormat('dd.MM.yyyy').format(date);
  }
}
