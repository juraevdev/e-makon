import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/data/demo_content.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/season_theme.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/motion.dart';
import '../auth/auth_provider.dart';
import '../home/catalog_provider.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> with AutomaticKeepAliveClientMixin {
  final _search = TextEditingController();
  String _query = '';
  String _category = 'all';

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() => _query = _search.text.trim().toLowerCase()));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<ShopProduct> get _products {
    final all = DemoContent.shopProducts;
    return all.where((p) {
      final qOk = _query.isEmpty ||
          p.name.toLowerCase().contains(_query) ||
          p.firmName.toLowerCase().contains(_query) ||
          p.description.toLowerCase().contains(_query);
      final cOk = _category == 'all' || p.category == _category;
      return qOk && cOk;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final t = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final season = SeasonTheme.of();
    final accent = season.accent;
    final products = _products;
    context.watch<HomeFeedProvider>();

    return Scaffold(
      body: AmbientBackdrop(
        intensity: 0.9,
        season: season,
        child: SafeArea(
          bottom: false,
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
                        t.shopSubtitle,
                        style: theme.textTheme.labelLarge?.copyWith(color: accent, letterSpacing: 0.2),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        t.shop,
                        style: theme.textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          fontSize: 26,
                          color: scheme.onSurface,
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
                      hintText: t.search,
                      hintStyle: TextStyle(color: scheme.onSurfaceVariant.withValues(alpha: 0.7)),
                      prefixIcon: Icon(Icons.search_rounded, color: accent),
                      filled: true,
                      fillColor: AppColors.surfaceContainerHigh.withValues(alpha: AppColors.isLight ? 0.9 : 0.55),
                    ),
                  ),
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
                        ('all', t.all),
                        ('flowers', t.flowers),
                        ('fertilizers', t.fertilizers),
                        ('tools', t.tools),
                      ])
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: Text(f.$2),
                            selected: _category == f.$1,
                            onSelected: (_) => setState(() => _category = f.$1),
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
              const SliverToBoxAdapter(child: SizedBox(height: 12)),
              if (products.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Text(
                      t.noProducts,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.62,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, i) => ShopProductCard(product: products[i]),
                      childCount: products.length,
                    ),
                  ),
                ),
              SliverToBoxAdapter(child: SizedBox(height: MediaQuery.paddingOf(context).bottom + 88)),
            ],
          ),
        ),
      ),
    );
  }
}

class ShopProductCard extends StatelessWidget {
  const ShopProductCard({super.key, required this.product, this.compact = false});

  final ShopProduct product;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final t = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final tint = Color(product.accent);
    return PressableScale(
      onTap: () => showShopBuySheet(context, product),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          color: AppColors.isLight ? Colors.white.withValues(alpha: 0.95) : AppColors.surfaceContainerHigh.withValues(alpha: 0.6),
          border: Border.all(color: tint.withValues(alpha: AppColors.isLight ? 0.2 : 0.3)),
          boxShadow: [
            BoxShadow(
              color: AppColors.isLight ? Colors.black.withValues(alpha: 0.05) : tint.withValues(alpha: 0.12),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: compact ? 1.15 : 1.05,
              child: product.hasImage
                  ? AppImage(
                      path: product.image,
                      fit: BoxFit.cover,
                      fallback: ColoredBox(
                        color: tint.withValues(alpha: 0.25),
                        child: Center(child: Text(product.emoji, style: const TextStyle(fontSize: 36))),
                      ),
                    )
                  : ColoredBox(
                      color: tint.withValues(alpha: AppColors.isLight ? 0.14 : 0.28),
                      child: Center(child: Text(product.emoji, style: TextStyle(fontSize: compact ? 32 : 40))),
                    ),
            ),
            Expanded(
              child: Padding(
                padding: EdgeInsets.fromLTRB(10, compact ? 6 : 8, 10, compact ? 8 : 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: compact ? 1 : 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: scheme.onSurface,
                            fontSize: compact ? 12 : 13,
                            height: 1.15,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      product.firmName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: scheme.onSurfaceVariant,
                            fontSize: compact ? 10 : 11,
                          ),
                    ),
                    const Spacer(),
                    Text(
                      product.priceLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                        fontSize: compact ? 12 : 13,
                      ),
                    ),
                    if (!compact) ...[
                      const SizedBox(height: 6),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: () => showShopBuySheet(context, product),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(34),
                            padding: EdgeInsets.zero,
                            backgroundColor: AppColors.primary,
                            foregroundColor: AppColors.onPrimary,
                          ),
                          child: Text(t.buy, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> showShopBuySheet(BuildContext context, ShopProduct product) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: AppColors.surfaceContainer,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
    builder: (ctx) => _ShopBuySheet(product: product),
  );
}

class _ShopBuySheet extends StatefulWidget {
  const _ShopBuySheet({required this.product});

  final ShopProduct product;

  @override
  State<_ShopBuySheet> createState() => _ShopBuySheetState();
}

class _ShopBuySheetState extends State<_ShopBuySheet> {
  late final TextEditingController _address;
  late final TextEditingController _phone;
  late final TextEditingController _notes;
  int _qty = 1;
  bool _submitting = false;
  String? _error;

  ShopProduct get product => widget.product;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _address = TextEditingController(text: user?.address ?? '');
    final raw = (user?.phone ?? '').replaceFirst('+998', '').replaceAll(RegExp(r'\D'), '');
    _phone = TextEditingController(text: raw.length > 9 ? raw.substring(raw.length - 9) : raw);
    _notes = TextEditingController();
  }

  @override
  void dispose() {
    _address.dispose();
    _phone.dispose();
    _notes.dispose();
    super.dispose();
  }

  int get _total => product.price * _qty;

  Future<void> _submit() async {
    final t = context.l10nRead;
    final address = _address.text.trim();
    final phoneDigits = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (address.isEmpty) {
      setState(() => _error = t.enterDeliveryAddress);
      return;
    }
    if (phoneDigits.length < 9) {
      setState(() => _error = t.enterPhone);
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final order = await context.read<OrdersProvider>().createShopOrder(
            product: product,
            quantity: _qty,
            address: address,
            phone: phoneDigits.length == 9 ? '+998$phoneDigits' : phoneDigits,
            notes: _notes.text.trim(),
          );
      if (!mounted) return;
      Navigator.pop(context);
      context.push('/order-payment', extra: order);
    } catch (_) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = t.error;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final tint = Color(product.accent);
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final pad = MediaQuery.paddingOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + pad + bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: AppColors.outlineVariant, borderRadius: BorderRadius.circular(99)),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: tint.withValues(alpha: 0.2),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: product.hasImage
                      ? AppImage(
                          path: product.image,
                          fit: BoxFit.cover,
                          fallback: Center(child: Text(product.emoji, style: const TextStyle(fontSize: 32))),
                        )
                      : Center(child: Text(product.emoji, style: const TextStyle(fontSize: 32))),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.name,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: scheme.onSurface,
                            ),
                      ),
                      const SizedBox(height: 2),
                      Text(product.firmName, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant)),
                      const SizedBox(height: 6),
                      Text(
                        '${product.priceLabel} · ${product.unit}',
                        style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (product.description.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(product.description, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant)),
            ],
            const SizedBox(height: 16),
            Text(t.quantity, style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700, color: scheme.onSurface)),
            const SizedBox(height: 8),
            Row(
              children: [
                _QtyBtn(
                  icon: Icons.remove_rounded,
                  onTap: _qty > 1 ? () => setState(() => _qty -= 1) : null,
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    '$_qty',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: scheme.onSurface),
                  ),
                ),
                _QtyBtn(
                  icon: Icons.add_rounded,
                  onTap: _qty < 99 ? () => setState(() => _qty += 1) : null,
                ),
                const Spacer(),
                Text(
                  '${ServiceModel.formatMoney(_total)} so‘m',
                  style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w900, fontSize: 18),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _address,
              textInputAction: TextInputAction.next,
              style: TextStyle(color: scheme.onSurface),
              decoration: InputDecoration(
                labelText: t.deliveryAddress,
                hintText: t.enterDeliveryAddress,
                prefixIcon: const Icon(Icons.location_on_outlined),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(9)],
              style: TextStyle(color: scheme.onSurface),
              decoration: InputDecoration(
                labelText: t.phone,
                hintText: '90 123 45 67',
                prefixIcon: const Icon(Icons.phone_outlined),
                prefixText: '+998 ',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _notes,
              maxLines: 2,
              style: TextStyle(color: scheme.onSurface),
              decoration: InputDecoration(
                labelText: t.orderNotes,
                hintText: t.orderNotesHint,
                prefixIcon: const Icon(Icons.notes_outlined),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: TextStyle(color: scheme.error, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.onPrimary,
                ),
                child: _submitting
                    ? SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.4, color: AppColors.onPrimary),
                      )
                    : Text(t.confirmPurchase, style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QtyBtn extends StatelessWidget {
  const _QtyBtn({required this.icon, this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Material(
      color: enabled ? AppColors.primary.withValues(alpha: 0.18) : AppColors.surfaceContainerHighest.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, color: enabled ? AppColors.primary : AppColors.onSurfaceVariant),
        ),
      ),
    );
  }
}
