import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/app_state.dart';
import '../../widgets/floating_chat_button.dart';
import '../home/home_screen.dart';
import '../messages/messages_screen.dart';
import '../orders/orders_screen.dart';
import '../profile/profile_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppState>().initChatBot();
    });
  }

  static const _screens = [
    HomeScreen(),
    OrdersScreen(),
    MessagesScreen(),
    ProfileScreen(),
  ];

  static const _icons = [
    Icons.home_outlined,
    Icons.receipt_long_outlined,
    Icons.chat_bubble_outline,
    Icons.person_outline,
  ];

  static const _activeIcons = [
    Icons.home,
    Icons.receipt_long,
    Icons.chat_bubble,
    Icons.person,
  ];

  static const _labels = [
    AppStrings.navHome,
    AppStrings.navOrders,
    AppStrings.navMessages,
    AppStrings.navProfile,
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: _screens,
          ),
          const FloatingChatButton(),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.darkSurface,
          border: Border(
            top: BorderSide(color: AppColors.darkBorder, width: 0.5),
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(4, (index) {
                return _buildNavItem(index);
              }),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index) {
    final isActive = _currentIndex == index;

    return GestureDetector(
      onTap: () => setState(() => _currentIndex = index),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(
          horizontal: isActive ? 16 : 12,
          vertical: 8,
        ),
        decoration: BoxDecoration(
          color: isActive
              ? AppColors.accentGreen.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isActive ? _activeIcons[index] : _icons[index],
              size: 22,
              color: isActive ? AppColors.mintGreen : AppColors.darkMuted,
            ),
            if (isActive) ...[
              const SizedBox(width: 6),
              Text(
                _labels[index],
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.mintGreen,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
