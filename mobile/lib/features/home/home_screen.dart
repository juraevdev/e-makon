import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/network/api_client.dart';
import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/season_theme.dart';
import '../../core/data/demo_content.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/partner_sheet.dart';
import '../../core/widgets/motion.dart';
import '../../core/widgets/service_badge_icon.dart';
import '../../core/widgets/widgets.dart';
import '../auth/auth_provider.dart';
import '../loyalty/loyalty_provider.dart';
import '../loyalty/loyalty_sheet.dart';
import 'catalog_provider.dart';
import 'shop_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with AutomaticKeepAliveClientMixin {
  final _page = PageController(viewportFraction: 0.9);
  final _search = TextEditingController();
  int _carouselIndex = 0;
  Timer? _carouselTimer;
  String _query = '';
  String _partnerFilter = 'all';

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() => _query = _search.text.trim().toLowerCase()));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final api = context.read<ApiClient>();
      context.read<CatalogProvider>().load();
      context.read<HomeFeedProvider>().load(api);
      _startCarousel();
    });
  }

  void _startCarousel() {
    _carouselTimer?.cancel();
    _carouselTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || !_page.hasClients) return;
      final feed = context.read<HomeFeedProvider>();
      if (feed.carousel.length < 2) return;
      final next = (_carouselIndex + 1) % feed.carousel.length;
      _page.animateToPage(next, duration: const Duration(milliseconds: 480), curve: Curves.easeOutCubic);
    });
  }

  /// Ilova qayta ochilganda katalog/bannerlar `EmakonApp` da yangilanadi; bu — qo'lda tortib yangilash.
  Future<void> _refresh() async {
    final api = context.read<ApiClient>();
    final loyalty = context.read<LoyaltyProvider>();
    await Future.wait([
      context.read<CatalogProvider>().load(silent: true),
      context.read<HomeFeedProvider>().load(api, silent: true, withLocation: false),
      if (context.read<AuthProvider>().isLoggedIn) loyalty.load(silent: true),
    ]);
  }

  @override
  void dispose() {
    _carouselTimer?.cancel();
    _page.dispose();
    _search.dispose();
    super.dispose();
  }

  void _openCarousel(CarouselItem item) {
    // Superadmin bannerni xizmatga bog'lagan bo'lsa — to'g'ridan-to'g'ri o'sha xizmat sahifasi.
    if (item.hasService) {
      context.push('/service/${item.serviceSlug}');
      return;
    }
    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: AppColors.surfaceContainer,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 16, 20, 28 + MediaQuery.paddingOf(ctx).bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: AppColors.outlineVariant, borderRadius: BorderRadius.circular(99)),
                ),
              ),
              if (item.hasImage) ...[
                const SizedBox(height: 16),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: AppImage(
                      path: item.image,
                      fallback: ColoredBox(color: Color(item.accent).withValues(alpha: 0.55)),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Text(item.title, style: Theme.of(ctx).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(item.subtitle, style: Theme.of(ctx).textTheme.bodyMedium),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  context.push('/service/${item.serviceSlug ?? 'landscape-design'}');
                },
                icon: const Icon(Icons.shopping_bag_outlined),
                label: Text(context.l10nRead.bookService),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  context.push('/service/${item.serviceSlug ?? 'free-consult'}');
                },
                icon: const Icon(Icons.info_outline),
                label: const Text('Xizmat bilan tanishish'),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final displayName = context.select<AuthProvider, String>((a) => a.user?.displayName ?? 'e-makon');
    final points = context.select<AuthProvider, int>((a) => a.user?.points ?? 0);
    final uzsPerPoint = context.select<LoyaltyProvider, int>((l) => l.uzsPerPoint);
    final allServices = context.select<CatalogProvider, List<ServiceModel>>((c) => c.services);
    final feed = context.watch<HomeFeedProvider>();
    final unread = context.select<MessagesProvider, int>((m) => m.unreadCount);
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Xayrli tong'
        : hour < 18
        ? 'Xayrli kun'
        : 'Xayrli kech';
    final season = SeasonTheme.of();
    final scheme = Theme.of(context).colorScheme;
    final partners = feed.partners.where((p) {
      final qOk =
          _query.isEmpty ||
          p.name.toLowerCase().contains(_query) ||
          p.tagline.toLowerCase().contains(_query) ||
          p.activity.toLowerCase().contains(_query);
      final fOk =
          _partnerFilter == 'all' ||
          p.tagline.toLowerCase().contains(_partnerFilter) ||
          p.activity.toLowerCase().contains(_partnerFilter);
      return qOk && fOk;
    }).toList();
    final popularSeen = <String>{};
    final popularServices = <ServiceModel>[];
    for (final s in [...allServices, ...DemoContent.catalogWithPrices]) {
      if (popularSeen.add(s.slug)) popularServices.add(s);
      if (popularServices.length >= 9) break;
    }
    final nearestFirms = feed.nearestPartners;
    final shopPreview = DemoContent.shopProducts.take(9).toList();
    final offers = _query.isEmpty
        ? feed.offers
        : feed.offers
              .where((o) => o.title.toLowerCase().contains(_query) || o.subtitle.toLowerCase().contains(_query))
              .toList();

    return Scaffold(
      body: AmbientBackdrop(
        intensity: 0.95,
        season: season,
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: _refresh,
            child: CustomScrollView(
              cacheExtent: 420,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 10, 12, 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    greeting,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.labelLarge?.copyWith(color: season.accent, letterSpacing: 0.2),
                                  ),
                                  const SizedBox(width: 8),
                                  SeasonChip(theme: season),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                displayName,
                                style: Theme.of(
                                  context,
                                ).textTheme.headlineMedium?.copyWith(fontSize: 24, fontWeight: FontWeight.w800),
                              ),
                              Text(
                                season.subtitle,
                                style: Theme.of(
                                  context,
                                ).textTheme.labelSmall?.copyWith(color: season.accentSoft.withValues(alpha: 0.9)),
                              ),
                            ],
                          ),
                        ),
                        PressableScale(
                          onTap: () => showLoyaltySheet(context),
                          child: _PointsChip(points: points, accent: season.accent),
                        ),
                        const SizedBox(width: 4),
                        IconButton(
                          onPressed: () => context.push('/messages'),
                          style: IconButton.styleFrom(
                            backgroundColor: AppColors.surfaceContainerHigh.withValues(alpha: 0.55),
                          ),
                          icon: Badge(
                            isLabelVisible: unread > 0,
                            label: Text('$unread'),
                            child: Icon(Icons.notifications_outlined, color: scheme.onSurface),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                    child: TextField(
                      controller: _search,
                      decoration: InputDecoration(
                        hintText: context.l10n.searchServices,
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: _query.isEmpty
                            ? null
                            : IconButton(
                                onPressed: () {
                                  _search.clear();
                                  setState(() => _partnerFilter = 'all');
                                },
                                icon: const Icon(Icons.close),
                              ),
                      ),
                    ),
                  ),
                ),

                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: PressableScale(
                      onTap: () => context.go('/plant-scan'),
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          gradient: LinearGradient(
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                            colors: [
                              season.accent.withValues(alpha: 0.22),
                              AppColors.surfaceContainerHigh.withValues(alpha: AppColors.isLight ? 0.95 : 0.55),
                            ],
                          ),
                          border: Border.all(color: season.accent.withValues(alpha: 0.35)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 46,
                              height: 46,
                              decoration: BoxDecoration(
                                color: season.accent.withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Icon(Icons.document_scanner_outlined, color: season.accent),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    context.l10n.plantScanner,
                                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                          fontWeight: FontWeight.w800,
                                          color: scheme.onSurface,
                                        ),
                                  ),
                                  Text(
                                    context.l10n.plantScannerSubtitle,
                                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                          color: scheme.onSurfaceVariant,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                            Icon(Icons.chevron_right_rounded, color: season.accent),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

                // Hero carousel
                if (feed.carousel.isNotEmpty) ...[
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 228,
                    child: PageView.builder(
                      controller: _page,
                      itemCount: feed.carousel.length,
                      onPageChanged: (i) => setState(() => _carouselIndex = i),
                      itemBuilder: (_, i) {
                        final item = feed.carousel[i];
                        final color = Color(item.accent);
                        final active = i == _carouselIndex;
                        return AnimatedScale(
                          scale: active ? 1 : 0.96,
                          duration: const Duration(milliseconds: 280),
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(6, 14, 6, 10),
                            child: PressableScale(
                              onTap: () => _openCarousel(item),
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(24),
                                  boxShadow: [
                                    BoxShadow(
                                      color: color.withValues(alpha: 0.32),
                                      blurRadius: 22,
                                      offset: const Offset(0, 12),
                                    ),
                                  ],
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(24),
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      if (item.hasImage)
                                        AppImage(
                                          path: item.image,
                                          fallback: ColoredBox(color: color.withValues(alpha: 0.55)),
                                        )
                                      else
                                        DecoratedBox(
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              begin: Alignment.topLeft,
                                              end: Alignment.bottomRight,
                                              colors: [
                                                color.withValues(alpha: 0.95),
                                                color.withValues(alpha: 0.55),
                                                AppColors.surfaceContainerHigh.withValues(alpha: 0.65),
                                              ],
                                            ),
                                          ),
                                        ),
                                      DecoratedBox(
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment.topCenter,
                                            end: Alignment.bottomCenter,
                                            colors: [
                                              Colors.black.withValues(alpha: 0.12),
                                              Colors.black.withValues(alpha: 0.38),
                                              Colors.black.withValues(alpha: 0.78),
                                            ],
                                          ),
                                        ),
                                      ),
                                      Padding(
                                        padding: const EdgeInsets.all(20),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            if (item.category.isNotEmpty)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: Colors.white.withValues(alpha: 0.18),
                                                borderRadius: BorderRadius.circular(99),
                                              ),
                                              child: Text(
                                                item.category,
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                            const Spacer(),
                                            Text(
                                              item.title,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 22,
                                                fontWeight: FontWeight.w800,
                                                height: 1.15,
                                              ),
                                            ),
                                            const SizedBox(height: 6),
                                            Text(
                                              item.subtitle,
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                color: Colors.white.withValues(alpha: 0.92),
                                                height: 1.3,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(feed.carousel.length, (i) {
                      final on = i == _carouselIndex;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: on ? 18 : 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: on ? AppColors.primary : AppColors.outlineVariant,
                          borderRadius: BorderRadius.circular(99),
                        ),
                      );
                    }),
                  ),
                ),
                ],

                // Points
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                    child: PressableScale(
                      onTap: () => showLoyaltySheet(context),
                      child: GlassCard(
                        borderRadius: 18,
                        child: Row(
                          children: [
                            Container(
                              width: 52,
                              height: 52,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(16),
                                gradient: LinearGradient(
                                  colors: [
                                    AppColors.primary.withValues(alpha: 0.35),
                                    AppColors.primary.withValues(alpha: 0.1),
                                  ],
                                ),
                              ),
                              child: Icon(Icons.stars_rounded, color: AppColors.primary),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Ballaringiz: $points', style: Theme.of(context).textTheme.titleMedium),
                                  Text(
                                    'Har ${ServiceModel.formatMoney(uzsPerPoint)} so‘m → 1 ball · mukofotlar',
                                    style: Theme.of(context).textTheme.labelSmall,
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.14),
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: Text(
                                'Bonus',
                                style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

                SliverToBoxAdapter(
                  child: SectionHeader(
                    title: context.l10n.partners,
                    subtitle: 'Ishonchli firmalar · reyting bilan',
                    icon: Icons.handshake_outlined,
                    accent: season.accent,
                  ),
                ),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 40,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      children: [
                        for (final f in [
                          ('all', context.l10n.all),
                          ('landshaft', 'Landshaft'),
                          ('sug', "Sug'orish"),
                          ('gazon', 'Gazon'),
                          ('daraxt', 'Daraxt'),
                          ('himoya', 'Himoya'),
                        ])
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: FilterChip(
                              label: Text(f.$2),
                              selected: _partnerFilter == f.$1,
                              onSelected: (_) => setState(() => _partnerFilter = f.$1),
                              selectedColor: season.accent.withValues(alpha: 0.25),
                              labelStyle: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: _partnerFilter == f.$1 ? season.accent : scheme.onSurface,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 10)),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 168,
                    child: partners.isEmpty
                        ? Center(
                            child: Text('Mos hamkor topilmadi', style: TextStyle(color: scheme.onSurfaceVariant)),
                          )
                        : ListView.separated(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            itemCount: partners.length,
                            separatorBuilder: (_, _) => const SizedBox(width: 12),
                            itemBuilder: (_, i) {
                              final p = partners[i];
                              final d = feed.distanceKm(p);
                              return PressableScale(
                                onTap: () => showPartnerSheet(context, p, distanceKm: d >= 0 ? d : null),
                                child: Container(
                                  width: 148,
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(20),
                                    gradient: LinearGradient(
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                      colors: AppColors.isLight
                                          ? [Colors.white, season.accent.withValues(alpha: 0.10)]
                                          : [AppColors.surfaceContainerHigh.withValues(alpha: 0.9), season.accent.withValues(alpha: 0.14)],
                                    ),
                                    border: Border.all(color: season.accent.withValues(alpha: 0.28)),
                                    boxShadow: [
                                      BoxShadow(
                                        color: AppColors.isLight
                                            ? Colors.black.withValues(alpha: 0.05)
                                            : season.accent.withValues(alpha: 0.12),
                                        blurRadius: 14,
                                        offset: const Offset(0, 6),
                                      ),
                                    ],
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          PartnerLogo(partner: p, size: 44),
                                          const Spacer(),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: season.accent.withValues(alpha: 0.16),
                                              borderRadius: BorderRadius.circular(99),
                                            ),
                                            child: Text(
                                              '★ ${p.rating}',
                                              style: TextStyle(color: season.accent, fontWeight: FontWeight.w800, fontSize: 11),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      Text(
                                        p.name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 14,
                                              color: scheme.onSurface,
                                            ),
                                      ),
                                      Text(
                                        p.tagline.isNotEmpty ? p.tagline : p.activity,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
                                      ),
                                      const Spacer(),
                                      Row(
                                        children: [
                                          Icon(Icons.place_outlined, size: 14, color: season.accent),
                                          const SizedBox(width: 4),
                                          Expanded(
                                            child: Text(
                                              d >= 0
                                                  ? '${d.toStringAsFixed(1)} ${context.l10n.kmAway}'
                                                  : (p.address.isNotEmpty ? p.address : '—'),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(color: season.accent, fontWeight: FontWeight.w700, fontSize: 11),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ),

                SliverToBoxAdapter(
                  child: SectionHeader(
                    title: context.l10n.popularServices,
                    subtitle: 'Kamida 9 ta tanlov',
                    icon: Icons.auto_awesome_rounded,
                    accent: season.accent,
                    trailing: TextButton(
                      onPressed: () => context.go('/services'),
                      child: Text(context.l10n.seeAll, style: TextStyle(color: season.accent, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 0.72,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, i) {
                        final s = popularServices[i];
                        final tint = Color(s.accent);
                        return PressableScale(
                          onTap: () => context.push('/service/${s.slug}'),
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              color: AppColors.isLight ? Colors.white.withValues(alpha: 0.95) : AppColors.surfaceContainerHigh.withValues(alpha: 0.55),
                              border: Border.all(color: tint.withValues(alpha: 0.28)),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  child: s.hasImage
                                      ? AppImage(path: s.image, fallback: ColoredBox(color: tint.withValues(alpha: 0.3)))
                                      : ColoredBox(
                                          color: tint.withValues(alpha: 0.22),
                                          child: Center(
                                            child: ServiceBadgeIcon(iconKey: s.icon, accent: tint, size: 36, emoji: s.emoji),
                                          ),
                                        ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(6, 6, 6, 8),
                                  child: Text(
                                    s.name,
                                    textAlign: TextAlign.center,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                          fontWeight: FontWeight.w800,
                                          color: scheme.onSurface,
                                          letterSpacing: 0,
                                        ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                      childCount: popularServices.length,
                    ),
                  ),
                ),

                SliverToBoxAdapter(
                  child: SectionHeader(
                    title: context.l10n.nearestFirms,
                    subtitle: 'Viloyatdagi eng yaqin 5 ta',
                    icon: Icons.near_me_rounded,
                    accent: season.accent,
                  ),
                ),
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, i) {
                      final p = nearestFirms[i];
                      final d = feed.distanceKm(p);
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                        child: PressableScale(
                          onTap: () => showPartnerSheet(context, p, distanceKm: d >= 0 ? d : null),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(18),
                              color: AppColors.isLight ? Colors.white.withValues(alpha: 0.94) : AppColors.surfaceContainerHigh.withValues(alpha: 0.65),
                              border: Border.all(color: AppColors.glassBorder),
                            ),
                            child: Row(
                              children: [
                                PartnerLogo(partner: p, size: 48),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        p.name,
                                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                              fontWeight: FontWeight.w800,
                                              color: scheme.onSurface,
                                            ),
                                      ),
                                      Text(
                                        p.address.isNotEmpty ? p.address : p.tagline,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
                                      ),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      d >= 0 ? '${d.toStringAsFixed(1)} ${context.l10n.kmAway}' : '—',
                                      style: TextStyle(color: season.accent, fontWeight: FontWeight.w800),
                                    ),
                                    Text('★ ${p.rating}', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant)),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                    childCount: nearestFirms.length,
                  ),
                ),

                SliverToBoxAdapter(
                  child: SectionHeader(
                    title: context.l10n.shop,
                    subtitle: context.l10n.shopSubtitle,
                    icon: Icons.storefront_rounded,
                    accent: season.accent,
                    trailing: TextButton(
                      onPressed: () => context.go('/shop'),
                      child: Text(context.l10n.seeAll, style: TextStyle(color: season.accent, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 228,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: shopPreview.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 12),
                      itemBuilder: (_, i) => SizedBox(
                        width: 148,
                        child: ShopProductCard(product: shopPreview[i], compact: true),
                      ),
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 16)),

                if (feed.offers.isNotEmpty)
                SliverToBoxAdapter(
                  child: SectionHeader(
                    title: context.l10n.offers,
                    subtitle: 'Bugungi tanlovlar',
                    icon: Icons.local_fire_department_rounded,
                    accent: season.accent,
                  ),
                ),
                if (feed.offers.isEmpty)
                  const SliverToBoxAdapter(child: SizedBox.shrink())
                else if (offers.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Text('Taklif topilmadi', style: TextStyle(color: AppColors.onSurfaceVariant)),
                    ),
                  )
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate((context, i) {
                      final o = offers[i];
                      final color = Color(o.accent);
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                        child: PressableScale(
                          onTap: () {
                            final slug = o.serviceSlug;
                            if (slug != null && slug.isNotEmpty) {
                              context.push('/service/$slug');
                            } else if (allServices.isNotEmpty) {
                              context.push('/service/${allServices.first.slug}');
                            }
                          },
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              gradient: LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  color.withValues(alpha: 0.5),
                                  AppColors.surfaceContainerHigh.withValues(alpha: 0.92),
                                ],
                              ),
                              border: Border.all(color: color.withValues(alpha: 0.35)),
                              boxShadow: [
                                BoxShadow(
                                  color: color.withValues(alpha: 0.18),
                                  blurRadius: 16,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(16),
                                  child: SizedBox(
                                    width: 78,
                                    height: 78,
                                    child: o.hasImage
                                        ? AppImage(
                                            path: o.image,
                                            fallback: ColoredBox(
                                              color: color.withValues(alpha: 0.35),
                                              child: Center(child: Text(o.emoji, style: const TextStyle(fontSize: 28))),
                                            ),
                                          )
                                        : ColoredBox(
                                            color: Colors.white.withValues(alpha: 0.12),
                                            child: Center(child: Text(o.emoji, style: const TextStyle(fontSize: 28))),
                                          ),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        o.title,
                                        style: Theme.of(
                                          context,
                                        ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, fontSize: 17),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        o.subtitle,
                                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                          color: AppColors.onSurface.withValues(alpha: 0.85),
                                          height: 1.3,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Icon(Icons.arrow_forward_rounded, color: color),
                              ],
                            ),
                          ),
                        ),
                      );
                    }, childCount: offers.length),
                  ),
                SliverToBoxAdapter(child: SizedBox(height: MediaQuery.paddingOf(context).bottom + 16)),
              ],
            ),
          ),
        ),
      ),
    );
  }

}

class _PointsChip extends StatelessWidget {
  _PointsChip({required this.points, Color? accent}) : accent = accent ?? AppColors.primary;
  final int points;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [accent.withValues(alpha: 0.22), accent.withValues(alpha: 0.08)]),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: accent.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.stars_rounded, size: 16, color: accent),
          const SizedBox(width: 4),
          Text(
            '$points',
            style: TextStyle(color: accent, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}
