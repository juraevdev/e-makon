import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../data/services_data.dart';
import '../../providers/app_state.dart';
import '../../widgets/glass_button.dart';
import '../../widgets/service_card.dart';
import '../messages/messages_screen.dart';
import '../order/order_flow_screen.dart';
import '../profile/edit_profile_screen.dart';
import '../search/search_screen.dart';
import '../services/service_detail_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static const _itemsPerPage = 6;
  static const _columns = 3;

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final displayName = appState.userName ?? 'Aziz ism';
    final stats = appState.userStats;
    final pageCount = (kServices.length / _itemsPerPage).ceil();

    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _buildHeader(context, appState, displayName, stats),
            ),
            SliverToBoxAdapter(child: _buildSearchBar(context)),
            SliverToBoxAdapter(child: _buildQuickOrder(context)),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
              sliver: SliverToBoxAdapter(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      AppStrings.ourServices,
                      style: GoogleFonts.inter(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.darkText,
                      ),
                    ),
                    GestureDetector(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const SearchScreen(),
                          ),
                        );
                      },
                      child: Text(
                        AppStrings.seeAll,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.accentGreen,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 220,
                child: PageView.builder(
                  controller: PageController(viewportFraction: 0.92),
                  itemCount: pageCount,
                  itemBuilder: (context, pageIndex) {
                    final start = pageIndex * _itemsPerPage;
                    final end = (start + _itemsPerPage).clamp(0, kServices.length);
                    final pageServices = kServices.sublist(start, end);

                    return Padding(
                      padding: EdgeInsets.only(
                        left: pageIndex == 0 ? 20 : 8,
                        right: 8,
                        top: 16,
                      ),
                      child: _buildServicePage(context, pageServices),
                    );
                  },
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                child: _buildSpecialOffer(context),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    AppState state,
    String displayName,
    stats,
  ) {
    final unread = state.unreadCount;
    final profile = state.profile;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.forestGreen.withValues(alpha: 0.35),
            AppColors.darkSurface,
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.accentGreen.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppStrings.greeting,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: AppColors.darkMuted,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      displayName,
                      style: GoogleFonts.inter(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: AppColors.mintGreen,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      AppStrings.tagline,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: AppColors.darkMuted.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const MessagesScreen()),
                  );
                },
                child: Stack(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: AppColors.darkBg.withValues(alpha: 0.4),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.notifications_outlined,
                        color: AppColors.darkText,
                        size: 20,
                      ),
                    ),
                    if (unread > 0)
                      Positioned(
                        top: 6,
                        right: 6,
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.error,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: () {
                  if (state.isAuthenticated) {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                    );
                  }
                },
                child: ProfileAvatar(
                  avatarPath: profile.avatarPath,
                  radius: 21,
                  fallbackUrl: 'https://i.pravatar.cc/150?img=12',
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _miniStat('${stats.plants}', AppStrings.statPlants),
              const SizedBox(width: 8),
              _miniStat('${stats.gardens}', AppStrings.statGardens),
              const SizedBox(width: 8),
              _miniStat(stats.growthLabel, AppStrings.statGrowth),
            ],
          ),
        ],
      ),
    );
  }

  Widget _miniStat(String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.darkBg.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.mintGreen,
              ),
            ),
            Text(
              label,
              style: GoogleFonts.inter(fontSize: 9, color: AppColors.darkMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickOrder(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: GlassActionButton(
        label: AppStrings.orderNow,
        icon: Icons.add_circle_outline,
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const OrderFlowScreen()),
          );
        },
      ),
    );
  }

  Widget _buildServicePage(BuildContext context, List services) {
    final rows = <List>[];
    for (var i = 0; i < services.length; i += _columns) {
      rows.add(services.sublist(i, (i + _columns).clamp(0, services.length)));
    }

    return Column(
      children: rows.map((row) {
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: List.generate(_columns, (colIndex) {
                if (colIndex >= row.length) {
                  return const Expanded(child: SizedBox());
                }
                final service = row[colIndex];
                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(left: colIndex > 0 ? 10 : 0),
                    child: ServiceCard(
                      service: service,
                      grid: true,
                      onTap: () => _openDetail(context, service.id),
                    ),
                  ),
                );
              }),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildSearchBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: GestureDetector(
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const SearchScreen()),
          );
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.darkSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.darkBorder),
          ),
          child: Row(
            children: [
              Icon(
                Icons.search,
                color: AppColors.darkMuted.withValues(alpha: 0.7),
                size: 22,
              ),
              const SizedBox(width: 12),
              Text(
                AppStrings.searchServices,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: AppColors.darkMuted.withValues(alpha: 0.7),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSpecialOffer(BuildContext context) {
    return Container(
      height: 170,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.network(
              'https://images.unsplash.com/photo-1585320806297-9794b1703bda?w=800',
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(color: AppColors.darkSurface),
            ),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [
                    Colors.black.withValues(alpha: 0.75),
                    Colors.black.withValues(alpha: 0.35),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    AppStrings.specialOffer,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.mintGreen,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    AppStrings.specialOfferDesc,
                    style: GoogleFonts.inter(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.white,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.mintGreen,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      AppStrings.details,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.darkBg,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openDetail(BuildContext context, String serviceId) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ServiceDetailScreen(serviceId: serviceId),
      ),
    );
  }
}
