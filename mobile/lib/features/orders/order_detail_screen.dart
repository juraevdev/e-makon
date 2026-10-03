import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/constants/service_icons.dart';
import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';
import '../home/catalog_provider.dart';

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.order});

  final OrderModel order;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  late OrderModel _order;
  bool _busy = false;
  Timer? _timer;

  static const _stageIcons = {
    'accepted': Icons.task_alt_rounded,
    'on_the_way': Icons.local_shipping_outlined,
    'arrived': Icons.place_rounded,
    'working': Icons.yard_outlined,
    'finished': Icons.verified_outlined,
  };

  @override
  void initState() {
    super.initState();
    _order = widget.order;
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
    // Firma bosqichni yangilaganda mijoz ekranida ham tez ko'rinsin.
    _timer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (_order.isActive) _refresh();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _openChat() {
    final feed = context.read<HomeFeedProvider>();
    final firmId = _order.firmId;
    if (firmId == null) return;
    final partner = feed.partnerById(firmId) ??
        PartnerModel(id: firmId, name: _order.partnerName, tagline: '', emoji: '🌿', fromServer: true);
    context.push('/chat', extra: partner);
  }

  Future<void> _refresh() async {
    try {
      final updated = await context.read<OrdersProvider>().refreshOrder(_order.id);
      if (mounted) setState(() => _order = updated);
    } catch (_) {
      // Oflayn yoki demo buyurtma — mavjud ma'lumot ko'rsatiladi.
    }
  }

  Future<void> _cancel() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceContainer,
        title: const Text('Buyurtmani bekor qilish'),
        content: const Text('Rostdan ham bekor qilmoqchimisiz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Yo'q")),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Bekor qilish', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    try {
      final orders = context.read<OrdersProvider>();
      final updated = await orders.cancel(_order.id);
      if (!mounted) return;
      setState(() => _order = updated);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Xatolik: $e'), behavior: SnackBarBehavior.floating),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stage = _order.workStageIndex;

    return Scaffold(
      appBar: AppBar(
        title: Text('Buyurtma #${_order.id}'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(20, 8, 20, 28 + MediaQuery.paddingOf(context).bottom),
        children: [
          GlassCard(
            borderRadius: 18,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_order.serviceName, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 20)),
                const SizedBox(height: 8),
                Text(
                  '${statusEmoji(_order.status)} ${_order.displayStatus}',
                  style: TextStyle(
                    color: _order.isCancelled ? AppColors.error : AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (_order.scheduledDate != null || _order.timeSlot.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (_order.scheduledDate != null) DateFormat('d MMM').format(_order.scheduledDate!),
                      if (_order.timeSlot.isNotEmpty) _order.timeSlot,
                    ].join(' · '),
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ],
                if (!_order.isCancelled) ...[
                  const SizedBox(height: 14),
                  GrowthProgressBar(progress: _order.progress),
                ],
              ],
            ),
          ),
          const SizedBox(height: 22),
          if (_order.isActive && _order.isOnTheWay && (_order.etaMinutes != null || _order.etaAt != null)) ...[
            _EtaCard(order: _order),
            const SizedBox(height: 16),
          ],
          if (!_order.isCancelled) ...[
            Text('Ish bosqichlari', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              _order.firmId == null
                  ? 'Buyurtma firmaga biriktirilgach, bosqichlar shu yerda yangilanadi'
                  : stage < 0 && !_order.isCompleted
                      ? '${_order.partnerName.isEmpty ? 'Firma' : _order.partnerName} buyurtmani ko‘rib chiqmoqda'
                      : 'Firma xodimlari har bir bosqichni belgilaydi',
              style: Theme.of(context).textTheme.labelSmall,
            ),
            const SizedBox(height: 14),
            ...List.generate(OrderModel.workStages.length, (i) {
              final (key, label) = OrderModel.workStages[i];
              final icon = _stageIcons[key]!;
              final done = _order.isCompleted || stage >= i;
              final current = stage == i && !_order.isCompleted;
              final at = _order.stageReachedAt(key);
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Row(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 280),
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: done ? AppColors.primary.withValues(alpha: current ? 0.35 : 0.2) : AppColors.glass,
                        border: Border.all(
                          color: done ? AppColors.primary : AppColors.outlineVariant,
                          width: current ? 2 : 1,
                        ),
                      ),
                      child: Icon(icon, color: done ? AppColors.primary : AppColors.onSurfaceVariant, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label,
                            style: TextStyle(
                              fontWeight: current || done ? FontWeight.w700 : FontWeight.w400,
                              color: done ? AppColors.onSurface : AppColors.onSurfaceVariant,
                            ),
                          ),
                          if (done && at != null)
                            Text(DateFormat('d MMM, HH:mm').format(at), style: Theme.of(context).textTheme.labelSmall),
                        ],
                      ),
                    ),
                    if (done) const Icon(Icons.check, color: AppColors.primary, size: 18),
                  ],
                ),
              );
            }),
            const SizedBox(height: 8),
          ],
          if (_order.firmId != null) ...[
            GlassCard(
              child: Column(
                children: [
                  _row('Firma', _order.partnerName.isEmpty ? '—' : _order.partnerName),
                  if (_order.workerName.isNotEmpty) _row('Mas’ul', _order.workerName),
                  if (_order.distanceKm > 0) _row('Masofa', '${_order.distanceKm.toStringAsFixed(1)} km'),
                ],
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _openChat,
              icon: const Icon(Icons.chat_bubble_outline, color: AppColors.primary),
              label: const Text('Firma bilan yozishish', style: TextStyle(color: AppColors.primary)),
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            ),
            const SizedBox(height: 16),
          ],
          GlassCard(
            child: Column(
              children: [
                _row('Sana', DateFormat('d MMM yyyy, HH:mm').format(_order.createdAt)),
                _row('Manzil', _order.address.isEmpty ? '—' : _order.address),
                _row('Telefon', _order.phoneNumber.isEmpty ? '—' : _order.phoneNumber),
                if (_order.notes.isNotEmpty) _row('Izoh', _order.notes),
                if (_order.amount > 0)
                  _row('Summa', '${NumberFormat.decimalPattern('uz').format(_order.amount)} so‘m'),
                if (_order.paymentStatus != 'not_required') _row("To'lov", _order.paymentLabel),
              ],
            ),
          ),
          if (_order.needsPayment || _order.isPaymentChecking) ...[
            const SizedBox(height: 20),
            PrimaryButton(
              label: _order.isPaymentChecking ? "To'lov holati" : "To'lash",
              icon: Icons.payments_outlined,
              onPressed: () async {
                await context.push('/order-payment', extra: _order);
                if (mounted) await _refresh();
              },
            ),
          ],
          if (_order.canCancel) ...[
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: _busy ? null : _cancel,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                side: const BorderSide(color: AppColors.error),
                foregroundColor: AppColors.error,
              ),
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.error),
                    )
                  : const Text('Buyurtmani bekor qilish'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 90, child: Text(k, style: const TextStyle(color: AppColors.onSurfaceVariant))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

class _EtaCard extends StatelessWidget {
  const _EtaCard({required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context) {
    final etaAt = order.etaAt?.toLocal();
    final left = etaAt?.difference(DateTime.now()).inMinutes;
    final minutes = left != null && left >= 0 ? left : order.etaMinutes;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          colors: [AppColors.primary.withValues(alpha: 0.28), AppColors.primary.withValues(alpha: 0.08)],
        ),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.45)),
      ),
      child: Row(
        children: [
          const Icon(Icons.local_shipping_outlined, color: AppColors.primary, size: 32),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Ishchi guruh yo‘lda', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                const SizedBox(height: 4),
                Text(
                  [
                    if (minutes != null) '~$minutes daqiqada yetib keladi',
                    if (etaAt != null) 'taxminan ${DateFormat('HH:mm').format(etaAt)}',
                    if (order.distanceKm > 0) '${order.distanceKm.toStringAsFixed(1)} km',
                  ].join(' · '),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
