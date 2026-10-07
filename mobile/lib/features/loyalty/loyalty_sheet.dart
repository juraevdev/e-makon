import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import 'loyalty_provider.dart';

/// Ballar balansi, mukofotlar va tarix — bosh sahifa va profildan ochiladi.
Future<void> showLoyaltySheet(BuildContext context) {
  final loyalty = context.read<LoyaltyProvider>();
  loyalty.load(silent: loyalty.loaded);
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    backgroundColor: AppColors.surfaceContainer,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
    builder: (_) => ChangeNotifierProvider.value(value: loyalty, child: const _LoyaltySheet()),
  );
}

class _LoyaltySheet extends StatelessWidget {
  const _LoyaltySheet();

  static String _money(int n) => ServiceModel.formatMoney(n);

  Future<void> _redeem(BuildContext context, LoyaltyReward reward) async {
    final loyalty = context.read<LoyaltyProvider>();
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceContainer,
        title: const Text('Mukofotni olish'),
        content: Text(
          '«${reward.name}» uchun ${reward.pointsCost} ball yechiladi.\n'
          'Qoladi: ${loyalty.balance - reward.pointsCost} ball. Davom etasizmi?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Yo'q")),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Ha, olish')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final msg = await loyalty.redeem(reward);
      messenger.showSnackBar(SnackBar(content: Text('$msg: ${reward.name}'), behavior: SnackBarBehavior.floating));
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(e is ApiException ? e.message : 'Almashtirib bo‘lmadi'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final loyalty = context.watch<LoyaltyProvider>();
    final theme = Theme.of(context);
    final date = DateFormat('dd.MM.yyyy HH:mm');

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      // Alohida ScaffoldMessenger — snackbar varaq ostida qolib ketmasligi uchun.
      builder: (_, scroll) => ScaffoldMessenger(
        child: Scaffold(
          backgroundColor: Colors.transparent,
          body: Builder(builder: (ctx) => _content(ctx, loyalty, scroll, theme, date)),
        ),
      ),
    );
  }

  Widget _content(
    BuildContext context,
    LoyaltyProvider loyalty,
    ScrollController scroll,
    ThemeData theme,
    DateFormat date,
  ) {
    return ListView(
      controller: scroll,
      padding: EdgeInsets.fromLTRB(20, 12, 20, 28 + MediaQuery.paddingOf(context).bottom),
      children: [
        Center(
          child: Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(color: AppColors.outlineVariant, borderRadius: BorderRadius.circular(99)),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            const Icon(Icons.stars_rounded, color: AppColors.primary, size: 30),
            const SizedBox(width: 10),
            Expanded(child: Text('Ballarim', style: theme.textTheme.headlineMedium)),
            if (loyalty.loading)
              const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          '${loyalty.balance} ball',
          style: theme.textTheme.headlineMedium?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w800),
        ),
        Text(
          'Har ${_money(loyalty.uzsPerPoint)} so‘m → 1 ball'
          '${loyalty.minRedeemPoints > 0 ? ' · almashtirish ${loyalty.minRedeemPoints} balldan' : ''}',
          style: theme.textTheme.labelSmall,
        ),
        if (loyalty.error != null) ...[
          const SizedBox(height: 12),
          Text(loyalty.error!, style: const TextStyle(color: AppColors.error)),
          TextButton.icon(
            onPressed: () => loyalty.load(),
            icon: const Icon(Icons.refresh),
            label: const Text('Qayta urinish'),
          ),
        ],
        const SizedBox(height: 18),
        Text('Mukofotlar', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        if (loyalty.rewards.isEmpty && !loyalty.loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('Hozircha faol mukofot yo‘q', style: TextStyle(color: AppColors.onSurfaceVariant)),
          ),
        for (final r in loyalty.rewards)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: _RewardIcon(icon: r.icon),
            title: Text(r.name),
            subtitle: Text('${r.pointsCost} ball'),
            trailing: FilledButton(
              onPressed: loyalty.canRedeem(r) ? () => _redeem(context, r) : null,
              style: FilledButton.styleFrom(minimumSize: const Size(76, 40)),
              child: loyalty.redeemingId == r.id
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Olish'),
            ),
          ),
        const SizedBox(height: 18),
        Text('Tarix', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        if (loyalty.history.isEmpty && !loyalty.loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'Buyurtma bajarilgach ballar shu yerda ko‘rinadi',
              style: TextStyle(color: AppColors.onSurfaceVariant),
            ),
          ),
        for (final t in loyalty.history)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: Icon(
              t.isPositive ? Icons.add_circle_outline : Icons.remove_circle_outline,
              color: t.isPositive ? AppColors.primary : AppColors.error,
            ),
            title: Text(t.note.isNotEmpty ? t.note : t.kindLabel),
            subtitle: Text('${t.kindLabel.isNotEmpty ? '${t.kindLabel} · ' : ''}${date.format(t.createdAt)}'),
            trailing: Text(
              '${t.isPositive ? '+' : ''}${t.points}',
              style: TextStyle(fontWeight: FontWeight.w800, color: t.isPositive ? AppColors.primary : AppColors.error),
            ),
          ),
      ],
    );
  }
}

class _RewardIcon extends StatelessWidget {
  const _RewardIcon({required this.icon});

  final String icon;

  @override
  Widget build(BuildContext context) {
    final isEmoji = icon.isNotEmpty && icon.runes.first > 0x2000;
    return SizedBox(
      width: 36,
      child: Center(
        child: isEmoji
            ? Text(icon, style: const TextStyle(fontSize: 26))
            : const Icon(Icons.card_giftcard_rounded, color: AppColors.primary),
      ),
    );
  }
}
