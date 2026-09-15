import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/app_state.dart';
import '../../widgets/glass_button.dart';
import '../../widgets/gradient_background.dart';
import '../auth/phone_auth_screen.dart';
import '../messages/messages_screen.dart';
import '../orders/orders_screen.dart';
import 'contact_screen.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: Consumer<AppState>(
        builder: (context, state, _) {
          if (!state.isAuthenticated) {
            return _buildGuest(context);
          }
          return _buildProfile(context, state);
        },
      ),
    );
  }

  Widget _buildGuest(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: AppColors.accentGreen.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.person_outline,
                size: 44,
                color: AppColors.mintGreen,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              AppStrings.notLoggedIn,
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.darkText,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              AppStrings.loginPrompt,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: AppColors.darkMuted,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 32),
            GlassActionButton(
              label: AppStrings.loginTitle,
              icon: Icons.login,
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const PhoneAuthScreen()),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfile(BuildContext context, AppState state) {
    final profile = state.profile;
    final stats = state.userStats;
    final displayName = profile.fullName.isNotEmpty
        ? profile.fullName
        : 'Azizbek Mansurov';
    final phone = state.phone ?? '+998 90 123 45 67';

    return GradientBackground(
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFF1A3D2E),
          Color(0xFF121212),
          Color(0xFF121212),
        ],
        stops: [0.0, 0.35, 1.0],
      ),
      child: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.menu, color: AppColors.darkText),
                      onPressed: () {},
                    ),
                    Expanded(
                      child: Text(
                        AppStrings.appName,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: AppColors.darkText,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => _openScreen(context, const EditProfileScreen()),
                      child: ProfileAvatar(
                        avatarPath: profile.avatarPath,
                        radius: 18,
                        fallbackUrl: 'https://i.pravatar.cc/150?img=12',
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Column(
                children: [
                  const SizedBox(height: 24),
                  GestureDetector(
                    onTap: () => _openScreen(context, const EditProfileScreen()),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppColors.accentGreen,
                              width: 3,
                            ),
                          ),
                          child: ProfileAvatar(
                            avatarPath: profile.avatarPath,
                            radius: 55,
                            fallbackUrl: 'https://i.pravatar.cc/300?img=12',
                          ),
                        ),
                        if (profile.isComplete)
                          Positioned(
                            bottom: 4,
                            right: MediaQuery.of(context).size.width / 2 - 68,
                            child: Container(
                              width: 28,
                              height: 28,
                              decoration: const BoxDecoration(
                                color: AppColors.accentGreen,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.check,
                                color: AppColors.white,
                                size: 16,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    displayName,
                    style: GoogleFonts.inter(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: AppColors.darkText,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    phone,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppColors.darkMuted,
                    ),
                  ),
                  if (profile.birthDate != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${AppStrings.birthDateHint}: ${profile.birthDate!.day}.${profile.birthDate!.month}.${profile.birthDate!.year}',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppColors.darkMuted,
                      ),
                    ),
                  ],
                  if (profile.formattedAddress.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(
                        profile.formattedAddress,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: AppColors.darkMuted,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 28),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      children: [
                        _statCard('${stats.plants}', AppStrings.statPlants),
                        const SizedBox(width: 10),
                        _statCard('${stats.gardens}', AppStrings.statGardens),
                        const SizedBox(width: 10),
                        _statCard(stats.growthLabel, AppStrings.statGrowth),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.darkSurface.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.darkBorder),
                      ),
                      child: Column(
                        children: [
                          _menuItem(
                            icon: Icons.edit_outlined,
                            title: AppStrings.editProfile,
                            onTap: () =>
                                _openScreen(context, const EditProfileScreen()),
                          ),
                          _divider(),
                          _menuItem(
                            icon: Icons.receipt_long_outlined,
                            title: AppStrings.navOrders,
                            onTap: () => _openScreen(context, const OrdersScreen()),
                          ),
                          _divider(),
                          _menuItem(
                            icon: Icons.phone_in_talk_outlined,
                            title: AppStrings.contactUs,
                            onTap: () =>
                                _openScreen(context, const ContactScreen()),
                          ),
                          _divider(),
                          _menuItem(
                            icon: Icons.star_outline,
                            title: AppStrings.feedback,
                            onTap: () {},
                          ),
                          _divider(),
                          _menuItem(
                            icon: Icons.notifications_outlined,
                            title: AppStrings.notifications,
                            onTap: () =>
                                _openScreen(context, const MessagesScreen()),
                          ),
                          _divider(),
                          _menuItem(
                            icon: Icons.info_outline,
                            title: AppStrings.aboutApp,
                            onTap: () {},
                          ),
                          _divider(),
                          _menuItem(
                            icon: Icons.logout,
                            title: AppStrings.logout,
                            isDestructive: true,
                            onTap: () => state.logout(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    '${AppStrings.appName.toUpperCase()} v2.4.0',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppColors.darkMuted.withValues(alpha: 0.6),
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statCard(String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: AppColors.darkSurface.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.darkBorder),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: AppColors.mintGreen,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label.toUpperCase(),
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: AppColors.darkMuted,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _menuItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    final color = isDestructive ? const Color(0xFFE57373) : AppColors.mintGreen;
    final textColor =
        isDestructive ? const Color(0xFFE57373) : AppColors.darkText;

    return ListTile(
      onTap: onTap,
      leading: Icon(icon, color: color, size: 22),
      title: Text(
        title,
        style: GoogleFonts.inter(
          fontSize: 15,
          fontWeight: FontWeight.w500,
          color: textColor,
        ),
      ),
      trailing: Icon(
        Icons.chevron_right,
        color: AppColors.darkMuted.withValues(alpha: 0.5),
        size: 20,
      ),
    );
  }

  Widget _divider() {
    return Divider(
      height: 1,
      indent: 56,
      color: AppColors.darkBorder.withValues(alpha: 0.5),
    );
  }

  void _openScreen(BuildContext context, Widget screen) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => screen),
    );
  }
}
