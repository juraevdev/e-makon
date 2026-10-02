import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/partner_sheet.dart';
import '../../core/widgets/service_badge_icon.dart';
import '../../core/widgets/widgets.dart';
import '../favorites/favorites_provider.dart';
import '../orders/order_flow_screen.dart';
import 'catalog_provider.dart';

class ServiceDetailScreen extends StatefulWidget {
  const ServiceDetailScreen({super.key, required this.slug});

  final String slug;

  @override
  State<ServiceDetailScreen> createState() => _ServiceDetailScreenState();
}

enum _OfferSort { price, rating, distance }

class _ServiceDetailScreenState extends State<ServiceDetailScreen> {
  List<ServiceOffer>? _offers;
  bool _loading = true;
  String? _error;
  _OfferSort _sort = _OfferSort.price;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load({bool refresh = false}) async {
    final catalog = context.read<CatalogProvider>();
    final service = catalog.bySlug(widget.slug);
    if (service == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final offers = await catalog.offersFor(service, refresh: refresh);
      if (mounted) setState(() => _offers = offers.where((o) => o.firm != null).toList());
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<ServiceOffer> _sorted(HomeFeedProvider feed) {
    final list = [...?_offers];
    switch (_sort) {
      case _OfferSort.price:
        list.sort((a, b) => a.price.compareTo(b.price));
      case _OfferSort.rating:
        list.sort((a, b) => (b.firm?.rating ?? 0).compareTo(a.firm?.rating ?? 0));
      case _OfferSort.distance:
        double d(ServiceOffer o) {
          final km = o.firm == null ? -1.0 : feed.distanceKm(o.firm!);
          return km < 0 ? double.infinity : km;
        }
        list.sort((a, b) => d(a).compareTo(d(b)));
    }
    return list;
  }

  void _order(ServiceModel service, [PartnerModel? partner]) {
    context.push('/order', extra: OrderFlowArgs(service: service, partner: partner));
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final feed = context.watch<HomeFeedProvider>();
    final service = catalog.bySlug(widget.slug);
    final favs = context.watch<FavoritesProvider>();

    if (service == null) {
      return Scaffold(
        appBar: AppBar(leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Xizmat topilmadi',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.onSurfaceVariant),
            ),
          ),
        ),
      );
    }

    final offers = _sorted(feed);
    final prices = offers.map((o) => o.price).where((p) => p > 0).toList()..sort();

    return Scaffold(
      appBar: AppBar(
        title: Text(service.name),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          IconButton(
            onPressed: () => favs.toggleService(service.id),
            icon: Icon(
              favs.isServiceFav(service.id) ? Icons.favorite : Icons.favorite_border,
              color: favs.isServiceFav(service.id) ? Colors.redAccent : null,
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => _load(refresh: true),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
          children: [
            if (service.hasImage)
              ClipRRect(
                borderRadius: BorderRadius.circular(22),
                child: AspectRatio(
                  aspectRatio: 16 / 10,
                  child: AppImage(
                    path: service.image,
                    fallback: ColoredBox(color: Color(service.accent).withValues(alpha: 0.35)),
                  ),
                ),
              )
            else
              Center(
                child: ServiceBadgeIcon(
                  iconKey: service.icon,
                  accent: Color(service.accent),
                  size: 96,
                  emoji: service.emoji,
                  image: service.image,
                ),
              ),
            const SizedBox(height: 24),
            Text(service.name, style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: 12),
            Text(
              service.description.isNotEmpty ? service.description : service.shortDescription,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.onSurfaceVariant,
                    height: 1.5,
                  ),
            ),
            const SizedBox(height: 24),
            GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Xizmat narxi', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text(
                    prices.isEmpty
                        ? service.priceLabel
                        : prices.first == prices.last
                            ? '${ServiceModel.formatMoney(prices.first)} so‘m'
                            : '${ServiceModel.formatMoney(prices.first)} – ${ServiceModel.formatMoney(prices.last)} so‘m',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          color: AppColors.primary,
                          fontSize: 22,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    offers.isEmpty
                        ? 'Narxni xizmat ko‘rsatuvchi firma belgilaydi'
                        : 'Har bir firma o‘z qat’iy narxini belgilagan — ${offers.length} ta firma',
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Row(
              children: [
                Expanded(child: Text('Firmalar va narxlar', style: Theme.of(context).textTheme.titleMedium)),
                if (offers.length > 1)
                  PopupMenuButton<_OfferSort>(
                    initialValue: _sort,
                    onSelected: (v) => setState(() => _sort = v),
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: _OfferSort.price, child: Text('Arzonroq')),
                      PopupMenuItem(value: _OfferSort.rating, child: Text('Reyting')),
                      PopupMenuItem(value: _OfferSort.distance, child: Text('Yaqinroq')),
                    ],
                    child: Row(
                      children: [
                        const Icon(Icons.sort_rounded, size: 18, color: AppColors.primary),
                        const SizedBox(width: 4),
                        Text(
                          switch (_sort) {
                            _OfferSort.price => 'Arzonroq',
                            _OfferSort.rating => 'Reyting',
                            _OfferSort.distance => 'Yaqinroq',
                          },
                          style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            if (_loading && _offers == null)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
              )
            else if (_error != null)
              GlassCard(
                child: Column(
                  children: [
                    Text('Firmalar narxini yuklab bo‘lmadi: $_error', textAlign: TextAlign.center),
                    TextButton(onPressed: () => _load(refresh: true), child: const Text('Qayta urinish')),
                  ],
                ),
              )
            else if (offers.isEmpty)
              const GlassCard(
                child: Text(
                  'Hozircha bu xizmatni tasdiqlangan narx bilan ko‘rsatadigan firma yo‘q. '
                  'Buyurtma qoldirsangiz, operator mos firmani biriktiradi.',
                  style: TextStyle(color: AppColors.onSurfaceVariant, height: 1.4),
                ),
              )
            else
              for (final o in offers)
                _OfferTile(
                  offer: o,
                  distanceKm: feed.distanceKm(o.firm!),
                  onSelect: () => _order(service, _withOffer(o)),
                  onInfo: () => showPartnerSheet(context, o.firm!, distanceKm: feed.distanceKm(o.firm!)),
                ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: ElevatedButton(
            onPressed: () => _order(service),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppColors.primaryContainer,
              shape: const StadiumBorder(),
              minimumSize: const Size.fromHeight(56),
            ),
            child: Text(offers.isEmpty ? 'Buyurtma berish' : 'Firma tanlab buyurtma berish'),
          ),
        ),
      ),
    );
  }

  PartnerModel _withOffer(ServiceOffer o) {
    final f = o.firm!;
    return PartnerModel(
      id: f.id,
      name: f.name,
      tagline: f.tagline,
      emoji: f.emoji,
      activity: f.activity,
      address: f.address,
      lat: f.lat,
      lng: f.lng,
      rating: f.rating,
      phone: f.phone,
      website: f.website,
      instagram: f.instagram,
      telegram: f.telegram,
      workHours: f.workHours,
      description: f.description,
      logo: f.logo,
      socials: f.socials,
      servicesCount: f.servicesCount,
      ratingsCount: f.ratingsCount,
      offer: PartnerOffer(serviceId: o.serviceId, name: o.name, price: o.price, duration: o.duration),
      fromServer: f.fromServer,
    );
  }
}

class _OfferTile extends StatelessWidget {
  const _OfferTile({required this.offer, required this.distanceKm, required this.onSelect, required this.onInfo});

  final ServiceOffer offer;
  final double distanceKm;
  final VoidCallback onSelect;
  final VoidCallback onInfo;

  @override
  Widget build(BuildContext context) {
    final firm = offer.firm!;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        onTap: onInfo,
        child: Row(
          children: [
            PartnerLogo(partner: firm, size: 46),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(firm.name, style: const TextStyle(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  Text(
                    [
                      '★ ${firm.rating.toStringAsFixed(1)}',
                      if (distanceKm >= 0) '${distanceKm.toStringAsFixed(1)} km',
                      if (offer.duration.isNotEmpty) offer.duration,
                    ].join(' · '),
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${ServiceModel.formatMoney(offer.price)} so‘m',
                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: onSelect,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 14),
              ),
              child: const Text('Tanlash'),
            ),
          ],
        ),
      ),
    );
  }
}
