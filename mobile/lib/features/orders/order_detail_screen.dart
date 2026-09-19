import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../../core/network/models.dart';
import '../../core/services/notification_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';
import '../auth/auth_provider.dart';
import '../home/catalog_provider.dart';

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.order});

  final OrderModel order;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  late OrderModel _order;

  static const _steps = [
    ('accepted', 'Qabul qilindi', Icons.check_circle_outline),
    ('on_way', "Yo'lga chiqdi", Icons.directions_car_outlined),
    ('arrived', 'Yetib keldi', Icons.place_outlined),
    ('done', 'Ish tugadi', Icons.verified_outlined),
  ];

  @override
  void initState() {
    super.initState();
    _order = widget.order;
  }

  int get _activeIndex {
    final s = _order.status;
    if (s == 'new') return -1;
    if (s == 'accepted') return 0;
    if (s == 'on_way') return 1;
    if (s == 'arrived' || s == 'in_progress') return 2;
    if (s == 'done') return 3;
    return 0;
  }

  LatLng get _dest {
    if (_order.lat != null && _order.lng != null) return LatLng(_order.lat!, _order.lng!);
    return const LatLng(41.31, 69.24);
  }

  LatLng get _partnerPos {
    if (_order.partnerLat != null && _order.partnerLng != null) {
      return LatLng(_order.partnerLat!, _order.partnerLng!);
    }
    // Demo: biroz siljitilgan nuqta
    return LatLng(_dest.latitude - 0.012, _dest.longitude + 0.008);
  }

  Future<void> _advance() async {
    await context.read<OrdersProvider>().advanceStatus(_order.id);
    final updated = context.read<OrdersProvider>().orders.firstWhere((o) => o.id == _order.id, orElse: () => _order);
    setState(() => _order = updated);
    if (_order.status == 'done' && mounted) {
      final pts = _order.pointsEarned > 0 ? _order.pointsEarned : OrderModel.pointsForAmount(_order.amount);
      await context.read<AuthProvider>().addPoints(pts);
      await NotificationService.instance.show(
        title: 'Buyurtma tugadi',
        body: '#${_order.id} · +$pts ball',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Buyurtma tugadi · +$pts ball'), behavior: SnackBarBehavior.floating),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = _activeIndex;
    final showMap = _order.status == 'on_way' || _order.status == 'arrived' || _order.status == 'accepted';

    return Scaffold(
      appBar: AppBar(
        title: Text('Buyurtma #${_order.id}'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        children: [
          GlassCard(
            borderRadius: 18,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_order.serviceName, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 20)),
                const SizedBox(height: 6),
                Text(
                  _order.partnerName.isEmpty ? _order.statusLabel : '${_order.partnerName} · ${_order.statusLabel}',
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
                ),
                if (_order.distanceKm > 0) ...[
                  const SizedBox(height: 4),
                  Text('Masofa: ${_order.distanceKm.toStringAsFixed(1)} km', style: Theme.of(context).textTheme.labelSmall),
                ],
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
                const SizedBox(height: 14),
                GrowthProgressBar(progress: _order.progress),
              ],
            ),
          ),
          if (showMap) ...[
            const SizedBox(height: 18),
            Text('Xaritada kuzatuv', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: SizedBox(
                height: 200,
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: _order.status == 'on_way' ? _partnerPos : _dest,
                    initialZoom: 13,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                      subdomains: const ['a', 'b', 'c', 'd'],
                      userAgentPackageName: 'uz.emakon.emakon_app',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: _dest,
                          width: 44,
                          height: 44,
                          child: const Icon(Icons.home_rounded, color: Colors.blueAccent, size: 36),
                        ),
                        if (_order.status == 'on_way' || _order.status == 'arrived')
                          Marker(
                            point: _partnerPos,
                            width: 44,
                            height: 44,
                            child: const Icon(Icons.local_shipping_rounded, color: AppColors.primary, size: 36),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 22),
          Text('Jonli kuzatuv', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 14),
          ...List.generate(_steps.length, (i) {
            final (key, label, icon) = _steps[i];
            final done = active >= i;
            final current = active == i && _order.status != 'done' && _order.status != 'cancelled';
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
                        if (current)
                          Text(
                            'Hozirgi holat · $key',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.primary),
                          ),
                      ],
                    ),
                  ),
                  if (done) const Icon(Icons.check, color: AppColors.primary, size: 18),
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
          GlassCard(
            child: Column(
              children: [
                _row('Sana', DateFormat('d MMM yyyy, HH:mm').format(_order.createdAt)),
                _row('Manzil', _order.address.isEmpty ? '—' : _order.address),
                _row('Telefon', _order.phoneNumber.isEmpty ? '—' : _order.phoneNumber),
                if (_order.amount > 0) _row('Summa', '${NumberFormat.decimalPattern('uz').format(_order.amount)} so‘m'),
                if (_order.pointsEarned > 0) _row('Ball', '+${_order.pointsEarned}'),
              ],
            ),
          ),
          if (_order.status != 'done' && _order.status != 'cancelled') ...[
            const SizedBox(height: 20),
            PrimaryButton(
              label: 'Keyingi holat (demo)',
              icon: Icons.skip_next_rounded,
              onPressed: _advance,
            ),
            const SizedBox(height: 8),
            Text(
              'Real tizimda holatlar firma ilovasidan keladi',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelSmall,
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
        children: [
          SizedBox(width: 90, child: Text(k, style: const TextStyle(color: AppColors.onSurfaceVariant))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
