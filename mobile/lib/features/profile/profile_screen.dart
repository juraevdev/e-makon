import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';
import '../auth/auth_provider.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profil'),
        automaticallyImplyLeading: false,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
        children: [
          GlassCard(
            child: Row(
              children: [
                const CircleAvatar(
                  radius: 36,
                  backgroundColor: AppColors.primaryContainer,
                  child: Icon(Icons.person, size: 36, color: AppColors.primary),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.fullName.isNotEmpty == true ? user!.fullName : 'Foydalanuvchi',
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 20),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        user?.phone ?? '',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.onSurfaceVariant,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          GlassCard(
            onTap: () => _editName(context, auth),
            child: const ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.badge_outlined, color: AppColors.primary),
              title: Text('Ismni tahrirlash'),
              trailing: Icon(Icons.chevron_right, color: AppColors.onSurfaceVariant),
            ),
          ),
          const SizedBox(height: 12),
          GlassCard(
            onTap: () => context.go('/orders'),
            child: const ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.receipt_long, color: AppColors.primary),
              title: Text('Buyurtmalarim'),
              trailing: Icon(Icons.chevron_right, color: AppColors.onSurfaceVariant),
            ),
          ),
          const SizedBox(height: 12),
          GlassCard(
            onTap: () {},
            child: const ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.support_agent, color: AppColors.primary),
              title: Text('Yordam / Support'),
              trailing: Icon(Icons.chevron_right, color: AppColors.onSurfaceVariant),
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () async {
              await auth.logout();
              if (context.mounted) context.go('/login');
            },
            icon: const Icon(Icons.logout, color: AppColors.error),
            label: const Text('Chiqish', style: TextStyle(color: AppColors.error)),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              side: const BorderSide(color: AppColors.error),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _editName(BuildContext context, AuthProvider auth) async {
    final ctrl = TextEditingController(text: auth.user?.fullName ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceContainer,
        title: const Text('Ism'),
        content: TextField(controller: ctrl, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Bekor')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Saqlash')),
        ],
      ),
    );
    if (ok == true) {
      try {
        await auth.updateProfile(fullName: ctrl.text.trim());
      } catch (_) {}
    }
  }
}
