import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/network/api_client.dart';
import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';
import '../home/catalog_provider.dart';

class _Provider {
  const _Provider(this.id, this.name, this.color);

  final String id;
  final String name;
  final Color color;
}

const _providers = [
  _Provider('click', 'Click', Color(0xFF00A3E8)),
  _Provider('payme', 'Payme', Color(0xFF00BFBF)),
];

/// Buyurtmadan keyingi to'lov: Click / Payme, pul avval tizim (escrow) hisobiga tushadi.
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key, required this.order});

  final OrderModel order;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  late OrderModel _order;
  String _provider = 'click';
  bool _started = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _order = widget.order;
    if (_order.paymentProvider.isNotEmpty) _provider = _order.paymentProvider;
  }

  OrdersProvider get _orders => context.read<OrdersProvider>();

  void _toast(String text) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text), behavior: SnackBarBehavior.floating),
    );
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
    } on ApiException catch (e) {
      if (mounted) _toast(e.message);
    } catch (_) {
      if (mounted) _toast("Server bilan bog'lanib bo'lmadi");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pay() => _run(() async {
        final updated = await _orders.startPayment(_order.id, _provider);
        if (!mounted) return;
        setState(() {
          _order = updated;
          _started = true;
        });
        final url = updated.checkoutUrl;
        if (url.isEmpty) {
          _toast("To'lov tizimi hali ulanmagan (test rejimi). To'lovdan so'ng pastdagi tugmani bosing.");
          return;
        }
        final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        if (!opened && mounted) _toast("To'lov sahifasini ochib bo'lmadi");
      });

  bool get _providerReady => _order.providerReady(_provider);

  bool get _paidByTest => _order.isPaid && _order.paymentProvider == 'test';

  Future<void> _payTest() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceContainer,
        title: const Text("Sinov to'lovi"),
        content: Text(
          "Click vaqtincha ulanmagan. To'lov o'tkazib yuboriladi va buyurtma "
          "${ServiceModel.formatMoney(_order.amount)} so'mga to'langan deb belgilanadi (soxta to'lov). "
          "Buyurtma darhol firmaga yuboriladi.",
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Bekor')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Davom etish')),
        ],
      ),
    );
    if (ok != true) return;
    await _run(() async {
      final updated = await _orders.payTest(_order.id);
      if (!mounted) return;
      setState(() => _order = updated);
      _toast("Soxta to'lov qilindi — buyurtma firmaga yuborildi");
    });
  }

  Future<void> _confirmSent() => _run(() async {
        final updated = await _orders.markPaymentSent(_order.id);
        if (mounted) setState(() => _order = updated);
      });

  Future<void> _refresh() => _run(() async {
        final updated = await _orders.refreshOrder(_order.id);
        if (!mounted) return;
        setState(() => _order = updated);
        if (updated.isPaymentChecking) _toast("To'lov hali tekshirilmoqda");
      });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final provider = _providers.firstWhere((p) => p.id == _provider);

    return Scaffold(
      appBar: AppBar(
        title: const Text("To'lov"),
        leading: IconButton(icon: const Icon(Icons.close), onPressed: () => context.go('/orders')),
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(20, 8, 20, 28 + MediaQuery.paddingOf(context).bottom),
        children: [
          GlassCard(
            borderRadius: 18,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("To'lov summasi", style: theme.textTheme.labelLarge),
                const SizedBox(height: 6),
                Text(
                  '${ServiceModel.formatMoney(_order.amount)} so‘m',
                  style: theme.textTheme.headlineMedium?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Buyurtma #${_order.id} · ${_order.allServices.join(', ')}',
                  style: theme.textTheme.labelSmall,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (_order.isPaymentChecking)
            _statusCard(
              icon: Icons.hourglass_top_rounded,
              title: "To'lov tekshirilmoqda",
              text: "Tizim to'lovingizni tekshirmoqda. Pul hisobga tushgach, buyurtmangiz ishga tushiriladi.",
            )
          else if (_paidByTest)
            _statusCard(
              icon: Icons.science_outlined,
              title: "Soxta to'lov qilindi",
              text: "Sinov rejimi: Click hozircha ulanmagan, shuning uchun to'lov o'tkazib yuborildi va "
                  "buyurtma to'langan deb belgilandi. Buyurtmangiz firmaga yuborildi — "
                  "firma qabul qilgach, bosqichlar shu yerda ko'rinadi.",
              color: const Color(0xFFFFB300),
            )
          else if (_order.isPaid)
            _statusCard(
              icon: Icons.verified_rounded,
              title: "To'lov tasdiqlandi",
              text: "Pul tizim hisobiga tushdi. Buyurtmangiz ishga tushirildi.",
            )
          else ...[
            if (_order.paymentStatus == 'rejected') ...[
              _statusCard(
                icon: Icons.error_outline,
                title: "To'lov hisobga tushmadi",
                text: "Oldingi to'lov tasdiqlanmadi. Iltimos, qayta urinib ko'ring.",
                color: AppColors.error,
              ),
              const SizedBox(height: 16),
            ],
            Text("To'lov usulini tanlang", style: theme.textTheme.titleMedium),
            const SizedBox(height: 10),
            Row(
              children: [
                for (final p in _providers) ...[
                  Expanded(child: _providerTile(p)),
                  if (p != _providers.last) const SizedBox(width: 12),
                ],
              ],
            ),
            if (!_providerReady && _order.testPaymentAllowed) ...[
              const SizedBox(height: 16),
              _statusCard(
                icon: Icons.link_off_rounded,
                title: '${provider.name} vaqtincha ulanmagan',
                text: "To'lov tizimi ulanguncha sinov rejimida to'lovni o'tkazib yuborishingiz mumkin. "
                    "Buyurtma \"soxta to'lov qilindi\" deb belgilanadi va darhol firmaga yuboriladi.",
                color: const Color(0xFFFFB300),
              ),
            ],
          ],
          const SizedBox(height: 16),
          _escrowNote(theme),
          const SizedBox(height: 20),
          if (_order.isPaymentChecking) ...[
            PrimaryButton(
              label: 'Holatni yangilash',
              icon: Icons.refresh,
              loading: _busy,
              onPressed: _refresh,
            ),
          ] else if (_order.isPaid) ...[
            PrimaryButton(
              label: "Chekni ko'rish",
              icon: Icons.receipt_long,
              onPressed: () => context.go('/order-success', extra: _order),
            ),
          ] else if (!_providerReady && _order.testPaymentAllowed) ...[
            PrimaryButton(
              label: "O'tkazib yuborish — soxta to'lov",
              icon: Icons.fast_forward_rounded,
              loading: _busy,
              onPressed: _busy ? null : _payTest,
            ),
          ] else ...[
            PrimaryButton(
              label: '${provider.name} orqali to‘lash',
              icon: Icons.open_in_new,
              loading: _busy && !_started,
              onPressed: _busy ? null : _pay,
            ),
            if (_started) ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _busy ? null : _confirmSent,
                icon: const Icon(Icons.check_circle_outline, color: AppColors.primary),
                label: const Text("To'lovni amalga oshirdim", style: TextStyle(color: AppColors.primary)),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  side: const BorderSide(color: AppColors.primary),
                ),
              ),
            ],
          ],
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => context.go('/orders'),
            child: Text(
              _order.isPaid || _order.isPaymentChecking ? 'Buyurtmalarim' : 'Keyinroq to‘lash',
              style: const TextStyle(color: AppColors.onSurfaceVariant),
            ),
          ),
        ],
      ),
    );
  }

  Widget _providerTile(_Provider p) {
    final selected = _provider == p.id;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: _busy
          ? null
          : () => setState(() {
                _provider = p.id;
                _started = false;
              }),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: selected ? p.color.withValues(alpha: 0.14) : AppColors.glass,
          border: Border.all(color: selected ? p.color : AppColors.glassBorder, width: selected ? 2 : 1),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(color: p.color, borderRadius: BorderRadius.circular(10)),
              child: Text(
                p.id,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  selected ? Icons.radio_button_checked : Icons.radio_button_off,
                  size: 18,
                  color: selected ? p.color : AppColors.onSurfaceVariant,
                ),
                const SizedBox(width: 6),
                Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
            if (_order.paymentOptions.isNotEmpty && !_order.providerReady(p.id)) ...[
              const SizedBox(height: 4),
              const Text('ulanmagan', style: TextStyle(color: Color(0xFFFFB300), fontSize: 11)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _statusCard({
    required IconData icon,
    required String title,
    required String text,
    Color color = AppColors.primary,
  }) {
    return GlassCard(
      borderRadius: 16,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 30),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 16)),
                const SizedBox(height: 4),
                Text(text, style: const TextStyle(color: AppColors.onSurfaceVariant, height: 1.35)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _escrowNote(ThemeData theme) {
    const body = TextStyle(color: AppColors.onSurfaceVariant, height: 1.45, fontSize: 13);
    return GlassCard(
      borderRadius: 16,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.shield_outlined, color: AppColors.primary),
              const SizedBox(width: 8),
              Text('Xavfsiz to‘lov', style: theme.textTheme.titleMedium),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            "Siz pul o'tkazganingizda u birinchi bo'lib tizim ma'muriyati hisobiga tushadi. "
            "Agar xizmat ko'rsatuvchi kelib ishlarni yakunlamasa, pulingiz qaytariladi. "
            "Agar xizmat ko'rsatuvchi ishlarni yakunlasa, pul kompaniya hisobiga o'tkaziladi.",
            style: body,
          ),
          const SizedBox(height: 8),
          const Text(
            "Bu xizmat ko'rsatuvchi va mijoz o'rtasida xavfsiz va ishonchli aloqani ta'minlash "
            "maqsadida tizim tomonidan bajariladi.",
            style: body,
          ),
          const SizedBox(height: 8),
          const Text(
            "To'lov qilingandan keyin tizim uni tekshiradi. Pul hisobga tushgach, buyurtmangizga ruxsat beriladi.",
            style: TextStyle(color: AppColors.primary, height: 1.45, fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
