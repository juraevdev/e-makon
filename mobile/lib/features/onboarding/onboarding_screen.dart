import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/emakon_logo.dart';
import '../../core/widgets/motion.dart';
import '../../core/widgets/widgets.dart';
import '../auth/auth_provider.dart';

class _IntroPage {
  const _IntroPage({
    required this.title,
    required this.body,
    required this.icon,
    required this.color,
    required this.badge,
  });
  final String title;
  final String body;
  final IconData icon;
  final Color color;
  final String badge;
}

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> with SingleTickerProviderStateMixin {
  final _controller = PageController();
  int _index = 0;
  late final AnimationController _iconPulse;

  static const pages = [
    _IntroPage(
      title: 'Makoningiz —\nbir platformada',
      body: 'Bog‘dorchilik va landshaft xizmatlarini tanlang, yaqin hamkorga buyurtma bering va jarayonni kuzating.',
      icon: Icons.park_rounded,
      color: AppColors.primary,
      badge: '01 · Platforma',
    ),
    _IntroPage(
      title: 'Jonli kuzatuv\nva navigator',
      body: 'Buyurtma holati: qabul → yo‘lda → yetib keldi → tugadi. Eng yaqin ofislar xaritada ko‘rinadi.',
      icon: Icons.route_rounded,
      color: Color(0xFF4FC3F7),
      badge: '02 · Jarayon',
    ),
    _IntroPage(
      title: 'Ballar bilan\nbonus xizmatlar',
      body: 'Har 100 000 so‘m uchun 10 ball. Ballaringizni bepul maslahat va bonuslarga almashtiring.',
      icon: Icons.auto_awesome_rounded,
      color: Color(0xFFFFB74D),
      badge: '03 · Bonus',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _iconPulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    _iconPulse.dispose();
    super.dispose();
  }

  Future<void> _finish({required bool register}) async {
    await context.read<AuthProvider>().completeOnboarding();
    if (!mounted) return;
    context.go(register ? '/register' : '/login');
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _index == pages.length - 1;
    final page = pages[_index];

    return Scaffold(
      body: AmbientBackdrop(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
                child: Row(
                  children: [
                    const EmakonLogo(size: 42, showWordmark: false),
                    const SizedBox(width: 10),
                    Text(
                      'e-makon',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                          ),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () => _finish(register: false),
                      child: Text(
                        'O‘tkazib yuborish',
                        style: TextStyle(color: AppColors.onSurfaceVariant.withValues(alpha: 0.9)),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  itemCount: pages.length,
                  onPageChanged: (i) => setState(() => _index = i),
                  itemBuilder: (_, i) {
                    final p = pages[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          ScaleTransition(
                            scale: Tween(begin: 0.96, end: 1.04).animate(
                              CurvedAnimation(parent: _iconPulse, curve: Curves.easeInOut),
                            ),
                            child: Container(
                              width: 148,
                              height: 148,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(40),
                                gradient: LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    p.color.withValues(alpha: 0.45),
                                    p.color.withValues(alpha: 0.12),
                                    AppColors.surfaceContainerHigh.withValues(alpha: 0.4),
                                  ],
                                ),
                                border: Border.all(color: p.color.withValues(alpha: 0.35)),
                                boxShadow: [
                                  BoxShadow(
                                    color: p.color.withValues(alpha: 0.28),
                                    blurRadius: 28,
                                    offset: const Offset(0, 14),
                                  ),
                                ],
                              ),
                              child: Icon(p.icon, size: 64, color: p.color),
                            ),
                          ),
                          const SizedBox(height: 28),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(
                              color: p.color.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text(
                              p.badge,
                              style: TextStyle(
                                color: p.color,
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            p.title,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                                  fontSize: 30,
                                  height: 1.15,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            p.body,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                  color: AppColors.onSurfaceVariant.withValues(alpha: 0.95),
                                  height: 1.45,
                                ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(pages.length, (i) {
                  final on = i == _index;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 280),
                    curve: Curves.easeOutCubic,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: on ? 26 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: on ? page.color : AppColors.outlineVariant,
                      borderRadius: BorderRadius.circular(99),
                      boxShadow: on
                          ? [BoxShadow(color: page.color.withValues(alpha: 0.45), blurRadius: 10)]
                          : null,
                    ),
                  );
                }),
              ),
              const SizedBox(height: 22),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: PrimaryButton(
                  label: isLast ? "Ro'yxatdan o'tish" : 'Davom etish',
                  icon: isLast ? Icons.person_add_alt_1_rounded : Icons.arrow_forward_rounded,
                  onPressed: () {
                    if (isLast) {
                      _finish(register: true);
                    } else {
                      _controller.nextPage(
                        duration: const Duration(milliseconds: 380),
                        curve: Curves.easeOutCubic,
                      );
                    }
                  },
                ),
              ),
              TextButton(
                onPressed: () => _finish(register: false),
                child: Text(
                  'Allaqachon hisobingiz bormi? Kirish',
                  style: TextStyle(color: AppColors.primary.withValues(alpha: 0.95)),
                ),
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),
      ),
    );
  }
}
