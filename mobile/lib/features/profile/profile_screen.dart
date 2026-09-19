import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/season_theme.dart';
import '../../core/utils/location_helper.dart';
import '../../core/widgets/motion.dart';
import '../../core/widgets/partner_sheet.dart';
import '../../core/widgets/service_badge_icon.dart';
import '../../core/widgets/widgets.dart';
import '../auth/auth_provider.dart';
import '../favorites/favorites_provider.dart';
import '../home/catalog_provider.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _email = TextEditingController();
  final _address = TextEditingController();
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _company = TextEditingController();
  bool _locating = false;
  bool _editing = false;
  bool _hydrated = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_hydrated) return;
    final u = context.read<AuthProvider>().user;
    if (u != null) {
      _email.text = u.email;
      _address.text = u.address;
      _first.text = u.firstName;
      _last.text = u.lastName;
      _company.text = u.company;
      _hydrated = true;
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _address.dispose();
    _first.dispose();
    _last.dispose();
    _company.dispose();
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 75);
    if (file == null) return;
    await context.read<AuthProvider>().updateProfile(avatarPath: file.path);
  }

  Future<void> _detectLocation() async {
    setState(() => _locating = true);
    final result = await LocationHelper.currentAddress();
    if (!mounted) return;
    setState(() => _locating = false);
    if (result == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('GPS ruxsati yoki xizmati yoqilmagan'), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    _address.text = result.label;
    final auth = context.read<AuthProvider>();
    final feed = context.read<HomeFeedProvider>();
    await auth.updateProfile(address: result.label);
    await feed.refreshLocation();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Manzil GPS orqali aniqlandi'), behavior: SnackBarBehavior.floating),
    );
  }

  Future<void> _save() async {
    await context.read<AuthProvider>().updateProfile(
          firstName: _first.text.trim(),
          lastName: _last.text.trim(),
          company: _company.text.trim(),
          email: _email.text.trim(),
          address: _address.text.trim(),
        );
    if (!mounted) return;
    setState(() => _editing = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Profil saqlandi'), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final favs = context.watch<FavoritesProvider>();
    final catalog = context.watch<CatalogProvider>().services;
    final feed = context.watch<HomeFeedProvider>();
    final orders = context.watch<OrdersProvider>().orders;
    final favServices = catalog.where((s) => favs.isServiceFav(s.id)).toList();
    final favPartners = feed.partners.where((p) => favs.isPartnerFav(p.id)).toList();
    final season = SeasonTheme.of();
    final accent = season.accent;
    final activeOrders = orders.where((o) => {'new', 'accepted', 'on_way', 'arrived', 'in_progress'}.contains(o.status)).length;

    return Scaffold(
      body: AmbientBackdrop(
        intensity: 0.95,
        season: season,
        showWeather: true,
        child: SafeArea(
          bottom: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              season.subtitle,
                              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                    color: accent,
                                    letterSpacing: 0.2,
                                  ),
                            ),
                            const SizedBox(width: 8),
                            SeasonChip(theme: season),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Profil',
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                                fontSize: 26,
                              ),
                        ),
                      ],
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () => setState(() => _editing = !_editing),
                    icon: Icon(_editing ? Icons.close : Icons.edit_outlined, size: 18, color: accent),
                    label: Text(
                      _editing ? 'Bekor' : 'Tahrirlash',
                      style: TextStyle(color: accent, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      accent.withValues(alpha: 0.45),
                      season.accentSoft.withValues(alpha: 0.35),
                      season.glowB.withValues(alpha: 0.4),
                      AppColors.surfaceContainerHigh.withValues(alpha: 0.85),
                    ],
                  ),
                  border: Border.all(color: accent.withValues(alpha: 0.35)),
                  boxShadow: [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.3),
                      blurRadius: 24,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Stack(
                      children: [
                        CircleAvatar(
                          radius: 40,
                          backgroundColor: accent.withValues(alpha: 0.25),
                          backgroundImage: user?.avatarPath != null ? FileImage(File(user!.avatarPath!)) : null,
                          child: user?.avatarPath == null
                              ? Text(
                                  (user?.displayName.isNotEmpty == true ? user!.displayName[0] : 'E').toUpperCase(),
                                  style: const TextStyle(fontSize: 30, color: Colors.white, fontWeight: FontWeight.w800),
                                )
                              : null,
                        ),
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Material(
                            color: accent,
                            shape: const CircleBorder(),
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: _pickAvatar,
                              child: const Padding(
                                padding: EdgeInsets.all(7),
                                child: Icon(Icons.camera_alt, size: 14, color: Colors.white),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.displayName ?? 'Foydalanuvchi',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 20),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            user?.phone ?? '',
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(Icons.star_rounded, color: Colors.white, size: 16),
                              const SizedBox(width: 4),
                              Text(
                                (user?.rating ?? 5).toStringAsFixed(1),
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(width: 10),
                              Icon(Icons.stars_rounded, color: Colors.white.withValues(alpha: 0.9), size: 16),
                              const SizedBox(width: 4),
                              Text(
                                '${user?.points ?? 0} ball',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _MiniStat(
                      icon: Icons.receipt_long_rounded,
                      label: 'Faol buyurtma',
                      value: '$activeOrders',
                      accent: accent,
                      onTap: () => context.go('/orders'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _MiniStat(
                      icon: Icons.favorite_rounded,
                      label: 'Sevimlilar',
                      value: '${favServices.length + favPartners.length}',
                      accent: accent,
                      onTap: null,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _MiniStat(
                      icon: Icons.stars_rounded,
                      label: 'Ballar',
                      value: '${user?.points ?? 0}',
                      accent: accent,
                      onTap: null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text('Shaxsiy ma’lumot', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              GlassCard(
                borderRadius: 18,
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _field(controller: _first, label: 'Ism', icon: Icons.person_outline, enabled: _editing, accent: accent),
                    const Divider(height: 1),
                    _field(controller: _last, label: 'Familiya', icon: Icons.badge_outlined, enabled: _editing, accent: accent),
                    const Divider(height: 1),
                    _field(controller: _company, label: 'Korxona / nom', icon: Icons.apartment_outlined, enabled: _editing, accent: accent),
                    const Divider(height: 1),
                    _field(
                      controller: _email,
                      label: 'Email',
                      icon: Icons.email_outlined,
                      enabled: _editing,
                      keyboard: TextInputType.emailAddress,
                      accent: accent,
                    ),
                    const Divider(height: 1),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: TextField(
                        controller: _address,
                        enabled: _editing,
                        maxLines: 2,
                        decoration: InputDecoration(
                          labelText: 'Yashash manzili',
                          border: InputBorder.none,
                          prefixIcon: Icon(Icons.place_outlined, color: _editing ? accent : null),
                          suffixIcon: IconButton(
                            tooltip: 'GPS',
                            onPressed: _locating ? null : _detectLocation,
                            icon: _locating
                                ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: accent))
                                : Icon(Icons.my_location, color: accent),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (_editing) ...[
                const SizedBox(height: 14),
                PrimaryButton(label: 'Saqlash', icon: Icons.save_outlined, onPressed: _save, roundedFull: true),
              ],
              if (favPartners.isNotEmpty) ...[
                const SizedBox(height: 22),
                Text('Sevimli hamkorlar', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                SizedBox(
                  height: 108,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: favPartners.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (_, i) {
                      final p = favPartners[i];
                      return PressableScale(
                        onTap: () {
                          final d = feed.distanceKm(p);
                          showPartnerSheet(context, p, distanceKm: d >= 0 ? d : null);
                        },
                        child: Container(
                          width: 100,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(18),
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                accent.withValues(alpha: 0.18),
                                AppColors.surfaceContainerHigh.withValues(alpha: 0.65),
                              ],
                            ),
                            border: Border.all(color: accent.withValues(alpha: 0.25)),
                          ),
                          child: Column(
                            children: [
                              PartnerLogo(partner: p, size: 44),
                              const SizedBox(height: 6),
                              Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                              Text('★ ${p.rating}', style: TextStyle(color: accent, fontSize: 11)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
              if (favServices.isNotEmpty) ...[
                const SizedBox(height: 22),
                Text('Sevimli xizmatlar', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                ...favServices.map((s) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: PressableScale(
                      onTap: () => context.push('/service/${s.slug}'),
                      child: GlassCard(
                        borderRadius: 16,
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            ServiceBadgeIcon(
                              iconKey: s.icon,
                              accent: Color(s.accent),
                              size: 44,
                              emoji: s.emoji,
                              image: s.image,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(s.name, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                                  Text(s.priceLabel, style: TextStyle(color: accent, fontSize: 12)),
                                ],
                              ),
                            ),
                            Icon(Icons.chevron_right_rounded, color: accent.withValues(alpha: 0.7)),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ],
              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: () async {
                  await auth.logout();
                  if (context.mounted) context.go('/login');
                },
                icon: const Icon(Icons.logout_rounded, color: AppColors.error),
                label: const Text('Chiqish', style: TextStyle(color: AppColors.error, fontWeight: FontWeight.w700)),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  side: BorderSide(color: AppColors.error.withValues(alpha: 0.55)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required bool enabled,
    required Color accent,
    TextInputType? keyboard,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: TextField(
        controller: controller,
        enabled: enabled,
        keyboardType: keyboard,
        decoration: InputDecoration(
          labelText: label,
          border: InputBorder.none,
          prefixIcon: Icon(icon, color: enabled ? accent : null),
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.icon,
    required this.label,
    required this.value,
    required this.accent,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              accent.withValues(alpha: 0.18),
              AppColors.surfaceContainerHigh.withValues(alpha: 0.6),
            ],
          ),
          border: Border.all(color: accent.withValues(alpha: 0.28)),
        ),
        child: Column(
          children: [
            Icon(icon, color: accent, size: 20),
            const SizedBox(height: 6),
            Text(value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: accent)),
            Text(label, textAlign: TextAlign.center, style: Theme.of(context).textTheme.labelSmall?.copyWith(fontSize: 10)),
          ],
        ),
      ),
    );
  }
}
