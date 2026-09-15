import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_strings.dart';
import '../../core/storage/onboarding_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/gradient_background.dart';
import '../auth/phone_auth_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pageController = PageController();
  int _currentPage = 0;

  static const _pages = [
    _OnboardingPageData(
      title: AppStrings.onboardingTitle1,
      description: AppStrings.onboardingDesc1,
      type: _IllustrationType.landscape,
      showEcoBadge: false,
      showProgressLine: false,
      primaryButton: false,
    ),
    _OnboardingPageData(
      title: AppStrings.onboardingTitle2,
      description: AppStrings.onboardingDesc2,
      type: _IllustrationType.irrigation,
      showEcoBadge: true,
      showProgressLine: true,
      primaryButton: true,
    ),
    _OnboardingPageData(
      title: AppStrings.onboardingTitle3,
      description: AppStrings.onboardingDesc3,
      type: _IllustrationType.order,
      showEcoBadge: false,
      showProgressLine: false,
      primaryButton: false,
      isLast: true,
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _finishOnboarding() async {
    await OnboardingStorage.markCompleted();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => const PhoneAuthScreen(),
        transitionsBuilder: (_, animation, __, child) =>
            FadeTransition(opacity: animation, child: child),
        transitionDuration: const Duration(milliseconds: 500),
      ),
    );
  }

  void _onNext() {
    if (_currentPage < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
      return;
    }
    _finishOnboarding();
  }

  @override
  Widget build(BuildContext context) {
    final page = _pages[_currentPage];

    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 20),
            _OnboardingHeader(showEcoBadge: page.showEcoBadge),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: _pages.length,
                onPageChanged: (index) => setState(() => _currentPage = index),
                itemBuilder: (context, index) {
                  final data = _pages[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      children: [
                        const SizedBox(height: 16),
                        Expanded(
                          child: _OnboardingIllustration(type: data.type),
                        ),
                        const SizedBox(height: 28),
                        Text(
                          data.title,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 26,
                            fontWeight: FontWeight.w700,
                            color: AppColors.darkText,
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          data.description,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            color: AppColors.darkMuted,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            if (page.showProgressLine) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 48),
                child: _EcoProgressLine(progress: (_currentPage + 1) / _pages.length),
              ),
              const SizedBox(height: 16),
            ],
            _PageIndicator(
              count: _pages.length,
              current: _currentPage,
            ),
            const SizedBox(height: 24),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: _OnboardingButton(
                label: page.isLast
                    ? AppStrings.onboardingStart
                    : AppStrings.onboardingNext,
                primary: page.primaryButton,
                onPressed: _onNext,
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _OnboardingPageData {
  const _OnboardingPageData({
    required this.title,
    required this.description,
    required this.type,
    required this.showEcoBadge,
    required this.showProgressLine,
    required this.primaryButton,
    this.isLast = false,
  });

  final String title;
  final String description;
  final _IllustrationType type;
  final bool showEcoBadge;
  final bool showProgressLine;
  final bool primaryButton;
  final bool isLast;
}

enum _IllustrationType { landscape, irrigation, order }

class _OnboardingHeader extends StatelessWidget {
  const _OnboardingHeader({required this.showEcoBadge});

  final bool showEcoBadge;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (showEcoBadge) ...[
          Text(
            'eco',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: AppColors.accentGreen,
              fontStyle: FontStyle.italic,
            ),
          ),
          const SizedBox(width: 6),
        ],
        const PlantLogo(size: 22, color: AppColors.accentGreen),
        const SizedBox(width: 8),
        Text(
          AppStrings.appName,
          style: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: AppColors.accentGreen,
          ),
        ),
      ],
    );
  }
}

class _OnboardingIllustration extends StatelessWidget {
  const _OnboardingIllustration({required this.type});

  final _IllustrationType type;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.darkBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          fit: StackFit.expand,
          children: [
            _buildScene(),
            if (type == _IllustrationType.order) ..._orderBadges(),
            Positioned(
              left: 16,
              bottom: 16,
              child: _MiniLogo(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScene() {
    switch (type) {
      case _IllustrationType.landscape:
        return const _LandscapeScene();
      case _IllustrationType.irrigation:
        return const _IrrigationScene();
      case _IllustrationType.order:
        return const _OrderScene();
    }
  }

  List<Widget> _orderBadges() {
    return [
      Positioned(
        top: 20,
        right: 20,
        child: _BadgeIcon(icon: Icons.calendar_month_rounded),
      ),
      Positioned(
        left: 20,
        bottom: 80,
        child: _BadgeIcon(icon: Icons.check_rounded),
      ),
    ];
  }
}

class _MiniLogo extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const PlantLogo(size: 14, color: AppColors.accentGreen),
          const SizedBox(width: 4),
          Text(
            AppStrings.appName,
            style: GoogleFonts.inter(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              color: AppColors.forestGreen,
            ),
          ),
        ],
      ),
    );
  }
}

class _BadgeIcon extends StatelessWidget {
  const _BadgeIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.accentGreen,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: AppColors.accentGreen.withValues(alpha: 0.35),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Icon(icon, color: AppColors.white, size: 22),
    );
  }
}

class _LandscapeScene extends StatelessWidget {
  const _LandscapeScene();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF87CEEB), Color(0xFFB8E6C8), Color(0xFF4CAF50)],
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF8D6E63), Color(0xFF6D4C41)],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 70,
            child: Container(
              width: 120,
              height: 8,
              decoration: BoxDecoration(
                color: const Color(0xFF5D4037),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          Positioned(
            bottom: 78,
            child: Icon(
              Icons.tablet_mac_rounded,
              size: 64,
              color: AppColors.darkSurface.withValues(alpha: 0.85),
            ),
          ),
          const Positioned(
            left: 24,
            bottom: 100,
            child: Icon(Icons.local_florist, color: Color(0xFF2E7D32), size: 36),
          ),
          const Positioned(
            right: 28,
            bottom: 110,
            child: Icon(Icons.park_rounded, color: Color(0xFF388E3C), size: 42),
          ),
          const Positioned(
            top: 40,
            right: 30,
            child: Icon(Icons.wb_sunny_rounded, color: Color(0xFFFFCA28), size: 40),
          ),
        ],
      ),
    );
  }
}

class _IrrigationScene extends StatelessWidget {
  const _IrrigationScene();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF81D4FA), Color(0xFFA5D6A7), Color(0xFF43A047)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: 50,
            left: 0,
            right: 0,
            child: Icon(
              Icons.home_rounded,
              size: 90,
              color: AppColors.white.withValues(alpha: 0.95),
            ),
          ),
          ...List.generate(3, (i) {
            return Positioned(
              bottom: 60 + i * 8.0,
              left: 40 + i * 70.0,
              child: Icon(
                Icons.water_drop,
                size: 28,
                color: Colors.lightBlueAccent.withValues(alpha: 0.9),
              ),
            );
          }),
          Positioned(
            top: 24,
            right: 24,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.white.withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.settings_remote_rounded,
                color: AppColors.accentGreen,
                size: 28,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderScene extends StatelessWidget {
  const _OrderScene();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFC8E6C9), Color(0xFF81C784), Color(0xFF388E3C)],
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          const Positioned(
            bottom: 30,
            child: Icon(Icons.deck_rounded, color: Color(0xFF6D4C41), size: 80),
          ),
          Container(
            width: 110,
            height: 180,
            decoration: BoxDecoration(
              color: AppColors.darkSurface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.darkBorder, width: 3),
            ),
            child: Column(
              children: [
                Container(
                  height: 28,
                  decoration: const BoxDecoration(
                    color: AppColors.accentGreen,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(17)),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    AppStrings.appName,
                    style: GoogleFonts.inter(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: AppColors.white,
                    ),
                  ),
                ),
                const Expanded(
                  child: Padding(
                    padding: EdgeInsets.all(8),
                    child: Column(
                      children: [
                        Icon(Icons.grass, color: AppColors.accentGreen, size: 32),
                        SizedBox(height: 8),
                        Icon(Icons.check_circle, color: AppColors.accentGreen, size: 24),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Positioned(
            left: 36,
            bottom: 70,
            child: Icon(Icons.person_rounded, color: Color(0xFF5D4037), size: 56),
          ),
        ],
      ),
    );
  }
}

class _EcoProgressLine extends StatelessWidget {
  const _EcoProgressLine({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final thumbX = (constraints.maxWidth - 28) * progress.clamp(0.0, 1.0);
        return SizedBox(
          height: 28,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Center(
                child: Container(
                  height: 3,
                  decoration: BoxDecoration(
                    color: AppColors.darkBorder,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Positioned(
                left: thumbX,
                top: 0,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: AppColors.accentGreen,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.accentGreen.withValues(alpha: 0.4),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                  child: const PlantLogo(size: 14, color: AppColors.white),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _PageIndicator extends StatelessWidget {
  const _PageIndicator({required this.count, required this.current});

  final int count;
  final int current;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (index) {
        final isActive = index == current;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: isActive ? 28 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: isActive ? AppColors.accentGreen : AppColors.darkBorder,
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}

class _OnboardingButton extends StatelessWidget {
  const _OnboardingButton({
    required this.label,
    required this.onPressed,
    this.primary = false,
  });

  final String label;
  final VoidCallback onPressed;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final bg = primary ? AppColors.accentGreen : const Color(0xFFF5F5F5);
    final fg = primary ? AppColors.white : AppColors.darkBg;

    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: bg,
          foregroundColor: fg,
          elevation: primary ? 4 : 0,
          shadowColor: AppColors.accentGreen.withValues(alpha: 0.35),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: fg,
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.arrow_forward_rounded, size: 20, color: fg),
          ],
        ),
      ),
    );
  }
}
