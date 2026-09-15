import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants/app_strings.dart';
import '../core/theme/app_colors.dart';
import '../screens/chat/chat_bot_screen.dart';

class FloatingChatButton extends StatelessWidget {
  const FloatingChatButton({super.key});

  static const double _size = 56;

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Positioned(
      right: 16,
      bottom: 72 + bottomPadding,
      child: Tooltip(
        message: AppStrings.chatBotTitle,
        child: Material(
          elevation: 8,
          shadowColor: AppColors.accentGreen.withValues(alpha: 0.4),
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: Ink(
            width: _size,
            height: _size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.accentGreen.withValues(alpha: 0.25),
              border: Border.all(
                color: AppColors.accentGreen.withValues(alpha: 0.6),
                width: 1.5,
              ),
            ),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ChatBotScreen()),
                );
              },
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.smart_toy_rounded,
                    color: AppColors.mintGreen,
                    size: 24,
                  ),
                  Text(
                    'AI',
                    style: GoogleFonts.inter(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: AppColors.mintGreen,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
