import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_language.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/network/api_client.dart';
import '../../core/network/models.dart';
import '../../core/settings/app_settings.dart';
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
import '../loyalty/loyalty_provider.dart';
import '../loyalty/loyalty_sheet.dart';

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

  UserModel? _shown;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_hydrated) return;
    final u = context.read<AuthProvider>().user;
    if (u != null) {
      _hydrate(u);
      _hydrated = true;
    }
  }

  void _hydrate(UserModel u) {
    _shown = u;
    _email.text = u.email;
    _address.text = u.address;
    _first.text = u.firstName;
    _last.text = u.lastName;
    _company.text = u.company;
  }

  Future<void> _reload() async {
    final auth = context.read<AuthProvider>();
    final loyalty = context.read<LoyaltyProvider>();
    await Future.wait([auth.refreshMe(), loyalty.load(silent: true)]);
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
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 75, maxWidth: 1024);
    if (file == null || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await context.read<AuthProvider>().uploadAvatar(file);
      final t = context.l10nRead;
      messenger.showSnackBar(
        SnackBar(content: Text(t.avatarUpdated), behavior: SnackBarBehavior.floating),
      );
    } catch (e) {
      final t = context.l10nRead;
      messenger.showSnackBar(
        SnackBar(content: Text('${t.avatarFailed}: $e'), behavior: SnackBarBehavior.floating),
      );
    }
  }

  ImageProvider? _avatarImage(UserModel? user) {
    final path = user?.avatarPath;
    if (path == null || path.isEmpty) return null;
    if (user!.hasNetworkAvatar || kIsWeb) return NetworkImage(path);
    return FileImage(File(path));
  }

  Future<void> _detectLocation() async {
    setState(() => _locating = true);
    final result = await LocationHelper.currentAddress();
    if (!mounted) return;
    setState(() => _locating = false);
    final t = context.l10nRead;
    if (result == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.gpsUnavailable), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    _address.text = result.label;
    final auth = context.read<AuthProvider>();
    final feed = context.read<HomeFeedProvider>();
    String message = t.addressDetected;
    try {
      await auth.updateProfile(address: result.label);
    } on ApiException catch (e) {
      message = e.message;
    }
    await feed.refreshLocation();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  Future<void> _save() async {
    try {
      await context.read<AuthProvider>().updateProfile(
            firstName: _first.text.trim(),
            lastName: _last.text.trim(),
            company: _company.text.trim(),
            email: _email.text.trim(),
            address: _address.text.trim(),
          );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    if (!mounted) return;
    setState(() => _editing = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(context.l10nRead.profileSaved), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.l10n;
    final settings = context.watch<AppSettings>();
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    // Server (firma/superadmin) profilni o'zgartirgan bo'lsa — tahrirlanmayotgan maydonlar yangilanadi.
    if (user != null && !_editing && !identical(user, _shown)) {
      _shown = user;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_editing && identical(context.read<AuthProvider>().user, user)) _hydrate(user);
      });
    }
    final avatar = _avatarImage(user);
    final favs = context.watch<FavoritesProvider>();
    final catalog = context.watch<CatalogProvider>().services;
    final feed = context.watch<HomeFeedProvider>();
    final orders = context.watch<OrdersProvider>().orders;
    final favServices = catalog.where((s) => favs.isServiceFav(s.id)).toList();
    final favPartners = feed.partners.where((p) => favs.isPartnerFav(p.id)).toList();
    final season = SeasonTheme.of();
    final accent = season.accent;
    final activeOrders = orders.where((o) => o.isActive).length;

    return Scaffold(
      body: AmbientBackdrop(
        intensity: 0.95,
        season: season,
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            color: accent,
            onRefresh: _reload,
            child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.paddingOf(context).bottom + 16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                season.localizedSubtitle(t),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                      color: accent,
                                      letterSpacing: 0.2,
                                    ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            SeasonChip(theme: season),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          t.profile,
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
                      _editing ? t.cancel : t.edit,
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
                          backgroundImage: avatar,
                          onBackgroundImageError: avatar == null ? null : (_, _) {},
                          child: avatar == null
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
                            user?.displayName ?? t.user,
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
                                '${user?.points ?? 0} ${t.points}',
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
                      icon: Icons.favorite_rounded,
                      label: t.favorites,
                      value: '${favServices.length + favPartners.length}',
                      accent: accent,
                      onTap: null,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _MiniStat(
                      icon: Icons.stars_rounded,
                      label: t.loyalty,
                      value: '${user?.points ?? 0}',
                      accent: accent,
                      onTap: () => showLoyaltySheet(context),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _ProfileNavCard(
                icon: Icons.receipt_long_rounded,
                title: t.orders,
                subtitle: '$activeOrders ${t.activeOrders.toLowerCase()}',
                accent: accent,
                onTap: () => context.push('/orders'),
              ),
              const SizedBox(height: 10),
              _ProfileNavCard(
                icon: Icons.chat_bubble_rounded,
                title: t.messages,
                subtitle: t.notifications,
                accent: accent,
                badge: context.watch<MessagesProvider>().unreadCount,
                onTap: () => context.push('/messages'),
              ),
              const SizedBox(height: 20),
              Text(t.settings, style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: Theme.of(context).colorScheme.onSurface,
                  )),
              const SizedBox(height: 10),
              GlassCard(
                borderRadius: 18,
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t.appearance, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: accent)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _ChoiceChip(
                          label: t.themeLight,
                          selected: settings.themeMode == ThemeMode.light,
                          accent: accent,
                          onTap: () => settings.setThemeMode(ThemeMode.light),
                        ),
                        _ChoiceChip(
                          label: t.themeDark,
                          selected: settings.themeMode == ThemeMode.dark,
                          accent: accent,
                          onTap: () => settings.setThemeMode(ThemeMode.dark),
                        ),
                        _ChoiceChip(
                          label: t.themeSystem,
                          selected: settings.themeMode == ThemeMode.system,
                          accent: accent,
                          onTap: () => settings.setThemeMode(ThemeMode.system),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(t.language, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: accent)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final lang in AppLanguage.supported)
                          _ChoiceChip(
                            label: lang.nativeLabel,
                            selected: settings.language == lang,
                            accent: accent,
                            onTap: () => settings.setLanguage(lang),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(t.personalInfo, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              GlassCard(
                borderRadius: 18,
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _field(controller: _first, label: t.firstName, icon: Icons.person_outline, enabled: _editing, accent: accent),
                    const Divider(height: 1),
                    _field(controller: _last, label: t.lastName, icon: Icons.badge_outlined, enabled: _editing, accent: accent),
                    const Divider(height: 1),
                    _field(controller: _company, label: t.company, icon: Icons.apartment_outlined, enabled: _editing, accent: accent),
                    const Divider(height: 1),
                    _field(
                      controller: _email,
                      label: t.email,
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
                          labelText: t.livingAddress,
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
                PrimaryButton(label: t.save, icon: Icons.save_outlined, onPressed: _save, roundedFull: true),
              ],
              if (favPartners.isNotEmpty) ...[
                const SizedBox(height: 22),
                Text(t.favoritePartners, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
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
                Text(t.favoriteServices, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
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
                icon: Icon(Icons.logout_rounded, color: AppColors.error),
                label: Text(t.logout, style: TextStyle(color: AppColors.error, fontWeight: FontWeight.w700)),
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

class _ProfileNavCard extends StatelessWidget {
  const _ProfileNavCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.onTap,
    this.badge = 0,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color accent;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return PressableScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: AppColors.isLight
                ? [Colors.white, accent.withValues(alpha: 0.10)]
                : [AppColors.surfaceContainerHigh.withValues(alpha: 0.8), accent.withValues(alpha: 0.16)],
          ),
          border: Border.all(color: accent.withValues(alpha: AppColors.isLight ? 0.22 : 0.3)),
          boxShadow: [
            BoxShadow(
              color: AppColors.isLight ? Colors.black.withValues(alpha: 0.05) : accent.withValues(alpha: 0.12),
              blurRadius: 14,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: accent),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: scheme.onSurface,
                        ),
                  ),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            if (badge > 0)
              Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: accent,
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  '$badge',
                  style: TextStyle(
                    color: AppColors.isLight ? Colors.white : AppColors.onPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
              ),
            Icon(Icons.chevron_right_rounded, color: accent.withValues(alpha: 0.85)),
          ],
        ),
      ),
    );
  }
}

class _ChoiceChip extends StatelessWidget {
  const _ChoiceChip({
    required this.label,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? accent.withValues(alpha: 0.22) : AppColors.surfaceContainerHigh.withValues(alpha: 0.55),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: selected ? accent : AppColors.outlineVariant.withValues(alpha: 0.55)),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              fontSize: 13,
              color: selected ? accent : AppColors.onSurface,
            ),
          ),
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
