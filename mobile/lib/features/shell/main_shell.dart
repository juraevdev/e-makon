import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';

class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onTap(int index) {
    navigationShell.goBranch(index, initialLocation: index == navigationShell.currentIndex);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.l10n;
    final systemBottom = MediaQuery.viewPaddingOf(context).bottom;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: RepaintBoundary(child: navigationShell),
      extendBody: true,
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.background.withValues(alpha: 0), AppColors.background],
            stops: const [0, 0.6],
          ),
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(12, 0, 12, systemBottom + 10),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.isLight
                  ? Colors.white.withValues(alpha: 0.96)
                  : AppColors.surfaceContainer.withValues(alpha: 0.94),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.glassBorder),
              boxShadow: [
                BoxShadow(
                  color: AppColors.navShadow,
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
              child: Row(
                children: [
                  _NavItem(
                    selected: navigationShell.currentIndex == 0,
                    icon: Icons.home_outlined,
                    activeIcon: Icons.home_rounded,
                    label: t.navHomeShort,
                    onTap: () => _onTap(0),
                    scheme: scheme,
                  ),
                  _NavItem(
                    selected: navigationShell.currentIndex == 1,
                    icon: Icons.grid_view_outlined,
                    activeIcon: Icons.grid_view_rounded,
                    label: t.services,
                    onTap: () => _onTap(1),
                    scheme: scheme,
                  ),
                  _NavItem(
                    selected: navigationShell.currentIndex == 2,
                    icon: Icons.document_scanner_outlined,
                    activeIcon: Icons.document_scanner_rounded,
                    label: t.navScanner,
                    onTap: () => _onTap(2),
                    scheme: scheme,
                    emphasize: true,
                  ),
                  _NavItem(
                    selected: navigationShell.currentIndex == 3,
                    icon: Icons.storefront_outlined,
                    activeIcon: Icons.storefront_rounded,
                    label: t.navShop,
                    onTap: () => _onTap(3),
                    scheme: scheme,
                  ),
                  _NavItem(
                    selected: navigationShell.currentIndex == 4,
                    icon: Icons.person_outline_rounded,
                    activeIcon: Icons.person_rounded,
                    label: t.navProfile,
                    onTap: () => _onTap(4),
                    scheme: scheme,
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

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.selected,
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.onTap,
    required this.scheme,
    this.emphasize = false,
  });

  final bool selected;
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final VoidCallback onTap;
  final ColorScheme scheme;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final idle = AppColors.isLight ? scheme.onSurfaceVariant : AppColors.onSurfaceVariant;
    final accent = AppColors.primary;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected
                ? accent.withValues(alpha: AppColors.isLight ? 0.12 : 0.16)
                : emphasize
                    ? accent.withValues(alpha: 0.08)
                    : Colors.transparent,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                selected || emphasize ? activeIcon : icon,
                color: selected || emphasize ? accent : idle,
                size: emphasize ? 24 : 22,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: selected || emphasize ? FontWeight.w800 : FontWeight.w500,
                  color: selected || emphasize ? accent : idle,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
