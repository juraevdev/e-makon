import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/theme/app_colors.dart';

class OrderStepIndicator extends StatelessWidget {
  const OrderStepIndicator({
    super.key,
    required this.currentStep,
    required this.steps,
  });

  final int currentStep;
  final List<String> steps;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(steps.length * 2 - 1, (index) {
        if (index.isOdd) {
          final stepIndex = index ~/ 2;
          final isActive = stepIndex < currentStep;
          return Expanded(
            child: Container(
              height: 2,
              color: isActive ? AppColors.forestGreen : AppColors.border,
            ),
          );
        }

        final stepIndex = index ~/ 2;
        final isActive = stepIndex <= currentStep;
        final isCurrent = stepIndex == currentStep;

        return Column(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: isActive ? AppColors.forestGreen : AppColors.border,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: isActive
                    ? Icon(
                        isCurrent ? null : Icons.check,
                        size: 14,
                        color: AppColors.white,
                      )
                    : Text(
                        '${stepIndex + 1}',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.mutedText,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              steps[stepIndex],
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: isCurrent ? FontWeight.w600 : FontWeight.w400,
                color: isCurrent ? AppColors.forestGreen : AppColors.mutedText,
              ),
            ),
          ],
        );
      }),
    );
  }
}
