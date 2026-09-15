import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/app_state.dart';
import '../../widgets/gradient_background.dart';
import '../../core/storage/onboarding_storage.dart';
import '../auth/phone_auth_screen.dart';
import '../onboarding/onboarding_screen.dart';
import '../shell/main_shell.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeIn);
    _scale = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );
    _controller.forward();

    Future.delayed(const Duration(seconds: 2), () async {
      if (!mounted) return;
      SystemChrome.setEnabledSystemUIMode(
        SystemUiMode.manual,
        overlays: SystemUiOverlay.values,
      );
      final isAuth = context.read<AppState>().isAuthenticated;
      final onboardingDone = await OnboardingStorage.isCompleted();

      final Widget next;
      if (isAuth) {
        next = const MainShell();
      } else if (!onboardingDone) {
        next = const OnboardingScreen();
      } else {
        next = const PhoneAuthScreen();
      }

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (_, __, ___) => next,
          transitionsBuilder: (_, animation, __, child) =>
              FadeTransition(opacity: animation, child: child),
          transitionDuration: const Duration(milliseconds: 600),
        ),
      );
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      extendBody: true,
      extendBodyBehindAppBar: true,
      body: SizedBox.expand(
        child: GradientBackground(
          child: FadeTransition(
            opacity: _fade,
            child: Column(
              children: [
                const Spacer(flex: 3),
                ScaleTransition(
                  scale: _scale,
                  child: Column(
                    children: [
                      Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          gradient: AppColors.logoGradient,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.accentGreen.withValues(alpha: 0.3),
                              blurRadius: 24,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const PlantLogo(size: 40),
                            const SizedBox(height: 4),
                            Text(
                              AppStrings.appName,
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: AppColors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        AppStrings.appName,
                        style: GoogleFonts.inter(
                          fontSize: 32,
                          fontWeight: FontWeight.w700,
                          color: AppColors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 40),
                        child: Text(
                          AppStrings.tagline,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w400,
                            color: AppColors.white.withValues(alpha: 0.9),
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(flex: 4),
                Column(
                  children: [
                    Container(
                      width: 40,
                      height: 2,
                      color: AppColors.white.withValues(alpha: 0.6),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      AppStrings.premiumHorticulture,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: AppColors.white.withValues(alpha: 0.7),
                        letterSpacing: 2.5,
                      ),
                    ),
                    SizedBox(height: MediaQuery.of(context).padding.bottom + 32),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
