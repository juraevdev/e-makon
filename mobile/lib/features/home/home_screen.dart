import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/constants/service_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';
import '../auth/auth_provider.dart';
import 'catalog_provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CatalogProvider>().load();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final catalog = context.watch<CatalogProvider>();
    final q = _search.text.trim().toLowerCase();
    final services = catalog.services.where((s) {
      if (q.isEmpty) return true;
      return s.name.toLowerCase().contains(q) || s.shortDescription.toLowerCase().contains(q);
    }).toList();

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              floating: true,
              titleSpacing: 20,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Assalomu alaykum!',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 20),
                  ),
                  Text(
                    auth.user?.fullName.isNotEmpty == true
                        ? auth.user!.fullName
                        : (auth.user?.phone ?? ''),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.primary),
                  ),
                ],
              ),
              actions: [
                IconButton(
                  onPressed: () {},
                  icon: Badge(
                    smallSize: 8,
                    child: const Icon(Icons.notifications_outlined),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.only(right: 16),
                  child: CircleAvatar(
                    radius: 18,
                    backgroundColor: AppColors.primaryContainer,
                    child: Icon(Icons.person, color: AppColors.primary, size: 20),
                  ),
                ),
              ],
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: TextField(
                  controller: _search,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Xizmat qidirish...',
                    prefixIcon: const Icon(Icons.search, color: AppColors.onSurfaceVariant),
                    filled: true,
                    fillColor: AppColors.surfaceContainerHigh.withValues(alpha: 0.4),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Xizmatlarimiz', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 22)),
                    TextButton(
                      onPressed: () {},
                      child: const Text('Hammasi', style: TextStyle(color: AppColors.primary)),
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.85,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final s = services[i];
                    final tint = serviceTint(i);
                    return GlassCard(
                      onTap: () => context.push('/service/${s.slug}'),
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: tint.withValues(alpha: 0.12),
                            ),
                            child: Icon(serviceIcon(s.icon), color: tint),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            s.name,
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: AppColors.onSurface,
                                  letterSpacing: 0,
                                ),
                          ),
                        ],
                      ),
                    );
                  },
                  childCount: services.length,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 100),
                child: GlassCard(
                  borderRadius: 16,
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Maxsus taklif',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AppColors.primary),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Bahorgi parvarish uchun 20% chegirma!',
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 20),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: () {},
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: AppColors.onPrimary,
                          shape: const StadiumBorder(),
                          minimumSize: const Size(120, 40),
                        ),
                        child: const Text('Batafsil'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
