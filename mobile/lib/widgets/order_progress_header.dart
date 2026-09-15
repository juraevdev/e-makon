import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants/app_strings.dart';
import '../core/theme/app_colors.dart';
import 'gradient_background.dart';

class OrderProgressHeader extends StatelessWidget {
  const OrderProgressHeader({
    super.key,
    required this.currentStep,
    required this.totalSteps,
    this.statusText,
    this.onClose,
  });

  final int currentStep;
  final int totalSteps;
  final String? statusText;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final progress = (currentStep + 1) / totalSteps;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const PlantLogo(size: 22, color: AppColors.accentGreen),
              const SizedBox(width: 8),
              Text(
                AppStrings.appName,
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.accentGreen,
                ),
              ),
              const Spacer(),
              IconButton(
                onPressed: onClose ?? () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close, color: AppColors.darkMuted),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Text(
                '${AppStrings.orderStepProgress} ${currentStep + 1}/$totalSteps',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.accentGreen,
                  letterSpacing: 0.5,
                ),
              ),
              const Spacer(),
              if (statusText != null)
                Text(
                  statusText!,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppColors.darkMuted,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 4,
              backgroundColor: AppColors.darkBorder,
              valueColor: const AlwaysStoppedAnimation(AppColors.accentGreen),
            ),
          ),
        ],
      ),
    );
  }
}

class OrderFinalStepHeader extends StatelessWidget {
  const OrderFinalStepHeader({
    super.key,
    required this.totalSteps,
    this.onBack,
  });

  final int totalSteps;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (onBack != null)
                IconButton(
                  onPressed: onBack,
                  icon: const Icon(Icons.arrow_back_rounded),
                  color: AppColors.darkMuted,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                ),
              Text(
                AppStrings.orderPlaceTitle,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.accentGreen,
                  letterSpacing: 1.2,
                ),
              ),
              const Spacer(),
              Text(
                '${AppStrings.orderStage} $totalSteps/$totalSteps',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: AppColors.darkTextSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Stack(
            clipBehavior: Clip.none,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: const LinearProgressIndicator(
                  value: 1,
                  minHeight: 3,
                  backgroundColor: AppColors.darkBorder,
                  valueColor:
                      AlwaysStoppedAnimation(AppColors.accentGreen),
                ),
              ),
              Positioned(
                right: -4,
                top: -10,
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: AppColors.darkBg,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.accentGreen.withValues(alpha: 0.4),
                    ),
                  ),
                  child: const PlantLogo(size: 12, color: AppColors.accentGreen),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class DashedUploadArea extends StatelessWidget {
  const DashedUploadArea({
    super.key,
    required this.child,
    this.onTap,
    this.color = AppColors.accentGreen,
  });

  final Widget child;
  final VoidCallback? onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: CustomPaint(
        painter: _DashedRectPainter(color: color.withValues(alpha: 0.7)),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
          child: child,
        ),
      ),
    );
  }
}

class _DashedRectPainter extends CustomPainter {
  _DashedRectPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    const radius = 20.0;
    const dashWidth = 8.0;
    const dashSpace = 6.0;

    final rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(1, 1, size.width - 2, size.height - 2),
      const Radius.circular(radius),
    );

    final path = Path()..addRRect(rect);
    final metrics = path.computeMetrics();

    for (final metric in metrics) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = distance + dashWidth;
        final extractPath = metric.extractPath(
          distance,
          next.clamp(0, metric.length),
        );
        canvas.drawPath(extractPath, paint);
        distance = next + dashSpace;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRectPainter oldDelegate) =>
      oldDelegate.color != color;
}
