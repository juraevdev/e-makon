import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../network/models.dart';
import '../theme/app_colors.dart';
import 'app_image.dart';
import 'widgets.dart';
import '../../features/auth/auth_provider.dart';
import '../../features/favorites/favorites_provider.dart';
import '../../features/reviews/reviews_provider.dart';

class PartnerLogo extends StatelessWidget {
  const PartnerLogo({super.key, required this.partner, this.size = 48});

  final PartnerModel partner;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.28),
      child: SizedBox(
        width: size,
        height: size,
        child: partner.hasLogo
            ? AppImage(path: partner.logo, fallback: _emojiFallback())
            : _emojiFallback(),
      ),
    );
  }

  Widget _emojiFallback() {
    return ColoredBox(
      color: AppColors.primary.withValues(alpha: 0.16),
      child: Center(child: Text(partner.emoji, style: TextStyle(fontSize: size * 0.42))),
    );
  }
}

Future<void> showPartnerSheet(BuildContext context, PartnerModel partner, {double? distanceKm}) {
  return showModalBottomSheet(
    context: context,
    useRootNavigator: true,
    useSafeArea: true,
    isScrollControlled: true,
    backgroundColor: AppColors.surfaceContainer,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
    builder: (ctx) {
      return DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.82,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (_, scroll) {
          return DefaultTabController(
            length: 4,
            child: Column(
              children: [
                const SizedBox(height: 10),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: AppColors.outlineVariant, borderRadius: BorderRadius.circular(99)),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                  child: Row(
                    children: [
                      PartnerLogo(partner: partner, size: 52),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(partner.name, style: Theme.of(ctx).textTheme.headlineMedium?.copyWith(fontSize: 20)),
                            Text(
                              [
                                partner.tagline,
                                if (distanceKm != null && distanceKm >= 0) '${distanceKm.toStringAsFixed(1)} km',
                              ].join(' · '),
                              style: Theme.of(ctx).textTheme.labelSmall,
                            ),
                          ],
                        ),
                      ),
                      Consumer2<ReviewsProvider, FavoritesProvider>(
                        builder: (_, reviews, favs, _) {
                          final avg = reviews.average(partner.id, fallback: partner.rating);
                          return Column(
                            children: [
                              Text('★ ${avg.toStringAsFixed(1)}',
                                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
                              IconButton(
                                tooltip: 'Sevimli',
                                onPressed: () => favs.togglePartner(partner.id),
                                icon: Icon(
                                  favs.isPartnerFav(partner.id) ? Icons.favorite : Icons.favorite_border,
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const TabBar(
                  isScrollable: true,
                  labelColor: AppColors.primary,
                  unselectedLabelColor: AppColors.onSurfaceVariant,
                  indicatorColor: AppColors.primary,
                  tabs: [
                    Tab(text: 'Faoliyat'),
                    Tab(text: 'Ishlar'),
                    Tab(text: 'Sharhlar'),
                    Tab(text: 'Aloqa'),
                  ],
                ),
                Expanded(
                  child: TabBarView(
                    children: [
                      ListView(
                        controller: scroll,
                        padding: const EdgeInsets.all(20),
                        children: [
                          Text(partner.activity.isEmpty ? 'Faoliyat haqida ma’lumot' : partner.activity,
                              style: Theme.of(ctx).textTheme.titleMedium),
                          const SizedBox(height: 10),
                          Text(
                            partner.description.isEmpty
                                ? 'Hamkorimiz ${partner.name} — ${partner.tagline.toLowerCase()} yo‘nalishida xizmat ko‘rsatadi.'
                                : partner.description,
                            style: Theme.of(ctx).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 16),
                          GlassCard(
                            child: Row(
                              children: [
                                const Icon(Icons.schedule, color: AppColors.primary),
                                const SizedBox(width: 10),
                                Text(partner.workHours),
                              ],
                            ),
                          ),
                          const SizedBox(height: 10),
                          GlassCard(
                            child: Row(
                              children: [
                                const Icon(Icons.place_outlined, color: AppColors.primary),
                                const SizedBox(width: 10),
                                Expanded(child: Text(partner.address.isEmpty ? 'Manzil kiritilmagan' : partner.address)),
                              ],
                            ),
                          ),
                          if (partner.servicesCount > 0) ...[
                            const SizedBox(height: 10),
                            GlassCard(
                              child: Row(
                                children: [
                                  const Icon(Icons.handyman_outlined, color: AppColors.primary),
                                  const SizedBox(width: 10),
                                  Text('${partner.servicesCount} ta tasdiqlangan xizmat'),
                                ],
                              ),
                            ),
                          ],
                          if (_socialsOf(partner).isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text('Ijtimoiy tarmoqlar', style: Theme.of(ctx).textTheme.titleMedium),
                            const SizedBox(height: 10),
                            SocialChips(partner: partner),
                          ],
                          const SizedBox(height: 16),
                          PrimaryButton(
                            label: 'Yozishma',
                            icon: Icons.chat_rounded,
                            onPressed: () {
                              Navigator.pop(ctx);
                              context.push('/chat', extra: partner);
                            },
                          ),
                        ],
                      ),
                      ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          if (partner.gallery.isEmpty)
                            const Text('Galereya hali bo‘sh', style: TextStyle(color: AppColors.onSurfaceVariant))
                          else
                            for (final g in partner.gallery) ...[
                              Text(g.caption.isEmpty ? 'Oldin / keyin' : g.caption,
                                  style: Theme.of(ctx).textTheme.titleMedium),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(child: _galleryHalf(g.before, 'Oldin')),
                                  const SizedBox(width: 8),
                                  Expanded(child: _galleryHalf(g.after, 'Keyin')),
                                ],
                              ),
                              const SizedBox(height: 16),
                            ],
                        ],
                      ),
                      _ReviewsTab(partner: partner, scroll: scroll),
                      ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          _linkTile(ctx, Icons.phone, 'Telefon', partner.phone, tel: true),
                          for (final s in _socialsOf(partner)) _linkTile(ctx, socialIcon(s.kind), s.label, s.url),
                          const SizedBox(height: 12),
                          PrimaryButton(
                            label: 'Navigatorni ochish',
                            icon: Icons.directions,
                            onPressed: () => openNavigator(partner.lat, partner.lng, label: partner.name),
                          ),
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: () {
                              Navigator.pop(ctx);
                              context.push('/chat', extra: partner);
                            },
                            icon: const Icon(Icons.chat_bubble_outline, color: AppColors.primary),
                            label: const Text('Chat ochish', style: TextStyle(color: AppColors.primary)),
                            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                SizedBox(height: MediaQuery.paddingOf(ctx).bottom),
              ],
            ),
          );
        },
      );
    },
  );
}

Widget _galleryHalf(String path, String label) {
  return Column(
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: AspectRatio(
          aspectRatio: 1,
          child: AppImage(path: path),
        ),
      ),
      const SizedBox(height: 4),
      Text(label, style: const TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant)),
    ],
  );
}

class _ReviewsTab extends StatelessWidget {
  const _ReviewsTab({required this.partner, required this.scroll});
  final PartnerModel partner;
  final ScrollController scroll;

  @override
  Widget build(BuildContext context) {
    final reviews = context.watch<ReviewsProvider>().forPartner(partner.id);
    return ListView(
      controller: scroll,
      padding: const EdgeInsets.all(20),
      children: [
        PrimaryButton(
          label: 'Sharh qoldirish',
          icon: Icons.star_rate_rounded,
          onPressed: () => _leaveReview(context, partner),
        ),
        const SizedBox(height: 14),
        if (reviews.isEmpty)
          const Text('Hali sharh yo‘q — birinchisini yozing', style: TextStyle(color: AppColors.onSurfaceVariant))
        else
          for (final r in reviews)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(r.author, style: Theme.of(context).textTheme.titleMedium),
                        const Spacer(),
                        Text('★ ${r.stars.toStringAsFixed(0)}', style: const TextStyle(color: AppColors.primary)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(r.text),
                    const SizedBox(height: 4),
                    Text(DateFormat('d MMM').format(r.createdAt), style: Theme.of(context).textTheme.labelSmall),
                  ],
                ),
              ),
            ),
      ],
    );
  }

  Future<void> _leaveReview(BuildContext context, PartnerModel partner) async {
    double stars = 5;
    final text = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceContainer,
        title: Text('${partner.name} ga baho'),
        content: StatefulBuilder(
          builder: (context, setLocal) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(5, (i) {
                    final n = i + 1;
                    return IconButton(
                      onPressed: () => setLocal(() => stars = n.toDouble()),
                      icon: Icon(
                        n <= stars ? Icons.star_rounded : Icons.star_outline_rounded,
                        color: AppColors.primary,
                      ),
                    );
                  }),
                ),
                TextField(
                  controller: text,
                  maxLines: 3,
                  decoration: const InputDecoration(hintText: 'Izohingiz…'),
                ),
              ],
            );
          },
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Bekor')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yuborish')),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      final name = context.read<AuthProvider>().user?.displayName ?? 'Siz';
      await context.read<ReviewsProvider>().add(
            partnerId: partner.id,
            author: name,
            stars: stars,
            text: text.text.trim().isEmpty ? 'Yaxshi xizmat' : text.text.trim(),
          );
      text.dispose();
    } else {
      text.dispose();
    }
  }
}

Widget _linkTile(BuildContext context, IconData icon, String title, String value, {bool tel = false}) {
  if (value.isEmpty) return const SizedBox.shrink();
  return Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: GlassCard(
      onTap: () async {
        final uri = tel
            ? Uri(scheme: 'tel', path: value)
            : Uri.parse(value.startsWith('http') ? value : 'https://$value');
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      },
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.labelSmall),
                Text(value, style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
          ),
          const Icon(Icons.open_in_new, size: 16, color: AppColors.onSurfaceVariant),
        ],
      ),
    ),
  );
}

/// Server `socials` bo'lmasa (demo hamkorlar) eski website/instagram/telegram maydonlaridan yig'iladi.
List<PartnerSocial> _socialsOf(PartnerModel p) {
  if (p.socials.isNotEmpty) return p.socials;
  return [
    if (p.telegram.isNotEmpty) PartnerSocial(kind: 'telegram_channel', label: 'Telegram', url: p.telegram),
    if (p.instagram.isNotEmpty) PartnerSocial(kind: 'instagram', label: 'Instagram', url: p.instagram),
    if (p.website.isNotEmpty) PartnerSocial(kind: 'website', label: 'Veb-sayt', url: p.website),
  ];
}

IconData socialIcon(String kind) => switch (kind) {
      'telegram_channel' => Icons.campaign_outlined,
      'telegram_group' => Icons.groups_outlined,
      'instagram' => Icons.camera_alt_outlined,
      'youtube' => Icons.smart_display_outlined,
      'facebook' => Icons.facebook,
      _ => Icons.language,
    };

Color socialColor(String kind) => switch (kind) {
      'telegram_channel' || 'telegram_group' => const Color(0xFF29B6F6),
      'instagram' => const Color(0xFFEC407A),
      'youtube' => const Color(0xFFEF5350),
      'facebook' => const Color(0xFF5C6BC0),
      _ => AppColors.primary,
    };

Future<void> openExternal(String value) async {
  if (value.isEmpty) return;
  final uri = Uri.parse(value.startsWith('http') ? value : 'https://$value');
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

Future<void> launchPhone(String phone) async {
  if (phone.isEmpty) return;
  await launchUrl(Uri(scheme: 'tel', path: phone));
}

class SocialChips extends StatelessWidget {
  const SocialChips({super.key, required this.partner});

  final PartnerModel partner;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final s in _socialsOf(partner))
          ActionChip(
            avatar: Icon(socialIcon(s.kind), size: 18, color: socialColor(s.kind)),
            label: Text(s.label),
            onPressed: () => openExternal(s.url),
            backgroundColor: socialColor(s.kind).withValues(alpha: 0.12),
            side: BorderSide(color: socialColor(s.kind).withValues(alpha: 0.4)),
            labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
          ),
      ],
    );
  }
}

Future<void> openNavigator(double lat, double lng, {String label = ''}) async {
  final uri = Uri.parse(
    'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving',
  );
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
