import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/season_theme.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/motion.dart';
import '../../core/widgets/service_badge_icon.dart';
import '../favorites/favorites_provider.dart';
import 'catalog_provider.dart';

class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key});

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> with AutomaticKeepAliveClientMixin {
  final _search = TextEditingController();
  String _query = '';
  String _category = 'all';
  int _page = 0;
  static const _perPage = 15;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _search.addListener(() {
      setState(() {
        _query = _search.text.trim().toLowerCase();
        _page = 0;
      });
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CatalogProvider>().load();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    await context.read<CatalogProvider>().load(silent: true);
  }

  static String categoryOf(ServiceModel s) {
    final c = s.category.trim();
    if (c.isNotEmpty) return c;
    final slug = s.slug.toLowerCase();
    final name = s.name.toLowerCase();
    if (slug.contains('consult') || name.contains('maslahat')) return 'Maslahat';
    if (slug.contains('design') || name.contains('dizayn')) return 'Dizayn';
    if (slug.contains('irrig') || name.contains("sug'or") || name.contains('sugor')) return 'Infratuzilma';
    if (slug.contains('warrant') || name.contains('kafolat') || name.contains('yearly')) return 'Kafolat';
    return 'Parvarish';
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final t = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final allServices = context.select<CatalogProvider, List<ServiceModel>>((c) => c.services);
    final catalogError = context.select<CatalogProvider, String?>((c) => c.error);
    final catalogLoading = context.select<CatalogProvider, bool>((c) => c.loading);
    final favs = context.watch<FavoritesProvider>();
    final season = SeasonTheme.of();
    final accent = season.accent;
    final width = MediaQuery.sizeOf(context).width;
    final cols = width >= 700 ? 4 : 3;

    final categories = <String>{
      for (final s in allServices)
        if (categoryOf(s).isNotEmpty) categoryOf(s),
    }.toList()
      ..sort();

    final filtered = allServices.where((s) {
      final qOk = _query.isEmpty ||
          s.name.toLowerCase().contains(_query) ||
          s.shortDescription.toLowerCase().contains(_query) ||
          s.category.toLowerCase().contains(_query) ||
          s.slug.contains(_query);
      final cOk = _category == 'all' || categoryOf(s) == _category;
      return qOk && cOk;
    }).toList();

    final pageCount = filtered.isEmpty ? 0 : ((filtered.length - 1) ~/ _perPage) + 1;
    final page = pageCount == 0 ? 0 : _page.clamp(0, pageCount - 1);
    final pageItems = filtered.skip(page * _perPage).take(_perPage).toList();

    return Scaffold(
      body: AmbientBackdrop(
        intensity: 0.95,
        season: season,
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            color: accent,
            onRefresh: _refresh,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          season.localizedSubtitle(t),
                          style: theme.textTheme.labelLarge?.copyWith(color: accent, letterSpacing: 0.2),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          t.services,
                          style: theme.textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            fontSize: 26,
                            color: scheme.onSurface,
                          ),
                        ),
                        Text(
                          'Aniq narx · tezkor buyurtma',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppColors.isLight
                                ? scheme.onSurfaceVariant
                                : season.accentSoft.withValues(alpha: 0.9),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                    child: TextField(
                      controller: _search,
                      style: theme.textTheme.bodyMedium?.copyWith(color: scheme.onSurface),
                      decoration: InputDecoration(
                        hintText: t.searchServices,
                        hintStyle: TextStyle(color: scheme.onSurfaceVariant.withValues(alpha: 0.7)),
                        prefixIcon: Icon(Icons.search_rounded, color: accent),
                        filled: true,
                        fillColor: AppColors.surfaceContainerHigh.withValues(alpha: AppColors.isLight ? 0.9 : 0.55),
                      ),
                    ),
                  ),
                ),
                if (allServices.isNotEmpty)
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: 40,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        children: [
                          for (final f in [('all', t.all), ...categories.map((c) => (c, c))])
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: FilterChip(
                                label: Text(f.$2),
                                selected: _category == f.$1,
                                onSelected: (_) => setState(() {
                                  _category = f.$1;
                                  _page = 0;
                                }),
                                selectedColor: accent.withValues(alpha: 0.25),
                                backgroundColor: AppColors.surfaceContainer.withValues(alpha: AppColors.isLight ? 0.9 : 0.5),
                                labelStyle: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: _category == f.$1 ? accent : scheme.onSurface,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: 10)),
                if (allServices.isEmpty && !catalogLoading)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              catalogError ?? t.noServices,
                              style: theme.textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                            ),
                          ),
                          TextButton(onPressed: _refresh, child: Text(t.retry)),
                        ],
                      ),
                    ),
                  )
                else if (filtered.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                      child: Text(
                        t.noServices,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverGrid(
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: cols,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: 0.66,
                      ),
                      delegate: SliverChildBuilderDelegate((context, i) {
                        final s = pageItems[i];
                        final tint = Color(s.accent);
                        return PressableScale(
                          onTap: () => context.push('/service/${s.slug}'),
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              color: AppColors.isLight
                                  ? Colors.white.withValues(alpha: 0.92)
                                  : AppColors.surfaceContainerHigh.withValues(alpha: 0.55),
                              border: Border.all(
                                color: AppColors.isLight
                                    ? tint.withValues(alpha: 0.22)
                                    : tint.withValues(alpha: 0.28),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.isLight
                                      ? Colors.black.withValues(alpha: 0.06)
                                      : tint.withValues(alpha: 0.12),
                                  blurRadius: AppColors.isLight ? 10 : 12,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      s.hasImage
                                          ? AppImage(
                                              path: s.image,
                                              fallback: ColoredBox(color: tint.withValues(alpha: 0.35)),
                                            )
                                          : ColoredBox(
                                              color: tint.withValues(alpha: AppColors.isLight ? 0.18 : 0.28),
                                              child: Center(
                                                child: ServiceBadgeIcon(
                                                  iconKey: s.icon,
                                                  accent: tint,
                                                  size: 50,
                                                  emoji: s.emoji,
                                                ),
                                              ),
                                            ),
                                      Positioned(
                                        top: 4,
                                        right: 4,
                                        child: Material(
                                          color: Colors.black45,
                                          shape: const CircleBorder(),
                                          child: InkWell(
                                            customBorder: const CircleBorder(),
                                            onTap: () => favs.toggleService(s.id),
                                            child: Padding(
                                              padding: const EdgeInsets.all(6),
                                              child: Icon(
                                                favs.isServiceFav(s.id) ? Icons.favorite : Icons.favorite_border,
                                                size: 16,
                                                color: favs.isServiceFav(s.id) ? Colors.redAccent : Colors.white,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(6, 7, 6, 8),
                                  child: Column(
                                    children: [
                                      Text(
                                        s.name,
                                        textAlign: TextAlign.center,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: theme.textTheme.labelSmall?.copyWith(
                                          color: scheme.onSurface,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 0,
                                        ),
                                      ),
                                      const SizedBox(height: 3),
                                      _PriceLine(service: s),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }, childCount: pageItems.length),
                    ),
                  ),
                if (pageCount > 1)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                      child: _PageTabs(
                        pageCount: pageCount,
                        currentPage: page,
                        totalCount: filtered.length,
                        pageSize: _perPage,
                        onChanged: (p) => setState(() => _page = p),
                      ),
                    ),
                  ),
                SliverToBoxAdapter(child: SizedBox(height: MediaQuery.paddingOf(context).bottom + 88)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PriceLine extends StatelessWidget {
  const _PriceLine({required this.service});
  final ServiceModel service;

  @override
  Widget build(BuildContext context) {
    final firms = service.firms.where((f) => f.price > 0).toList();
    final from = firms.isNotEmpty ? firms.first.price : service.priceMin;
    final small = Theme.of(context).textTheme.labelSmall;
    return Column(
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            from > 0 ? '${ServiceModel.formatMoney(from)} so‘mdan' : 'Narx kelishiladi',
            maxLines: 1,
            style: small?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 11),
          ),
        ),
        Text(
          service.offersCount > 0 ? '${service.offersCount} ta firma' : 'Operator orqali',
          maxLines: 1,
          style: small?.copyWith(fontSize: 10, color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
      ],
    );
  }
}

class _PageTabs extends StatelessWidget {
  const _PageTabs({
    required this.pageCount,
    required this.currentPage,
    required this.totalCount,
    required this.pageSize,
    required this.onChanged,
  });

  final int pageCount;
  final int currentPage;
  final int totalCount;
  final int pageSize;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceContainer.withValues(alpha: AppColors.isLight ? 0.95 : 0.7),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.glassBorder),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          child: pageCount <= 5
              ? Row(children: [for (var i = 0; i < pageCount; i++) Expanded(child: _tab(i, scheme))])
              : SizedBox(
                  height: 52,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: pageCount,
                    separatorBuilder: (_, _) => const SizedBox(width: 4),
                    itemBuilder: (_, i) => SizedBox(width: 72, child: _tab(i, scheme)),
                  ),
                ),
        ),
        const SizedBox(height: 8),
        Text(
          '${currentPage * pageSize + 1}–${(currentPage * pageSize + pageSize).clamp(0, totalCount)} / $totalCount',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
        ),
      ],
    );
  }

  Widget _tab(int i, ColorScheme scheme) {
    final selected = i == currentPage;
    final start = i * pageSize + 1;
    final end = ((i + 1) * pageSize).clamp(0, totalCount);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Material(
        color: selected ? AppColors.primary.withValues(alpha: 0.22) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => onChanged(i),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '${i + 1}',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: selected ? AppColors.primary : scheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$start–$end',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: selected ? AppColors.primary : scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
