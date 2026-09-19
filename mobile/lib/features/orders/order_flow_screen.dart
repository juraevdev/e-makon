import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/constants/api_config.dart';
import '../../core/network/api_client.dart';
import '../../core/network/models.dart';
import '../../core/services/notification_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/location_helper.dart';
import '../../core/utils/price_calculator.dart';
import '../../core/widgets/partner_sheet.dart';
import '../../core/widgets/service_badge_icon.dart';
import '../../core/widgets/widgets.dart';
import '../auth/auth_provider.dart';
import '../home/catalog_provider.dart';

class OrderFlowScreen extends StatefulWidget {
  const OrderFlowScreen({super.key, required this.service});

  final ServiceModel service;

  @override
  State<OrderFlowScreen> createState() => _OrderFlowScreenState();
}

class _OrderFlowScreenState extends State<OrderFlowScreen> {
  static const _slots = ['09:00 – 12:00', '12:00 – 15:00', '15:00 – 18:00'];

  int _step = 0;
  final _area = TextEditingController();
  final _address = TextEditingController();
  final _notes = TextEditingController();
  final _phone = TextEditingController();
  final _images = <XFile>[];
  final _cart = <ServiceModel>[];
  bool _submitting = false;
  bool _locating = false;
  PartnerModel? _partner;
  String? _error;
  DateTime _scheduledDate = DateTime.now().add(const Duration(days: 1));
  String _timeSlot = _slots.first;
  double? _lat;
  double? _lng;

  @override
  void initState() {
    super.initState();
    _cart.add(widget.service);
    _area.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = context.read<AuthProvider>().user;
      final phone = user?.phone ?? '';
      if (phone.isNotEmpty) {
        _phone.text = phone.replaceFirst('+998', '').replaceAll(' ', '');
      }
      if (user?.address.isNotEmpty == true) {
        _address.text = user!.address;
      }
      final partners = context.read<HomeFeedProvider>().partners;
      if (partners.isNotEmpty) setState(() => _partner = partners.first);
      final feed = context.read<HomeFeedProvider>();
      _lat = feed.userLat;
      _lng = feed.userLng;
    });
  }

  @override
  void dispose() {
    _area.dispose();
    _address.dispose();
    _notes.dispose();
    _phone.dispose();
    super.dispose();
  }

  double get _areaM2 => double.tryParse(_area.text.trim().replaceAll(',', '.')) ?? 0;

  int get _estimate => PriceCalculator.estimateCart(_cart, _areaM2);

  Future<void> _pickImages() async {
    final files = await ImagePicker().pickMultiImage(imageQuality: 80);
    if (files.isEmpty) return;
    setState(() {
      _images.addAll(files);
      while (_images.length > 3) {
        _images.removeLast();
      }
    });
  }

  Future<void> _detectLocation() async {
    setState(() => _locating = true);
    final result = await LocationHelper.currentAddress();
    if (!mounted) return;
    setState(() => _locating = false);
    if (result == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('GPS ruxsati yoki xizmati yoqilmagan'), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    setState(() {
      _address.text = result.label;
      _lat = result.lat;
      _lng = result.lng;
      _error = null;
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _scheduledDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 60)),
    );
    if (picked != null) setState(() => _scheduledDate = picked);
  }

  bool _validateStep1() {
    if (_address.text.trim().isEmpty) {
      setState(() => _error = 'Manzil majburiy');
      return false;
    }
    if (_area.text.trim().isEmpty) {
      setState(() => _error = 'Maydon majburiy');
      return false;
    }
    if (_notes.text.trim().isEmpty) {
      setState(() => _error = 'Izoh majburiy — bog‘ holatini yozing');
      return false;
    }
    if (_images.length < 2) {
      setState(() => _error = 'Kamida 2 ta rasm yuklang (maks. 3)');
      return false;
    }
    setState(() => _error = null);
    return true;
  }

  Future<void> _submit() async {
    if (_cart.isEmpty) {
      setState(() => _error = 'Kamida 1 ta xizmat bo‘lsin');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final feed = context.read<HomeFeedProvider>();
      final dist = _partner == null ? 0.0 : feed.distanceKm(_partner!);
      final order = await context.read<OrdersProvider>().create(
            services: List.of(_cart),
            areaSize: _area.text.trim(),
            address: _address.text.trim(),
            notes: _notes.text.trim(),
            phone: _phone.text.trim(),
            partnerName: _partner?.name ?? '',
            distanceKm: dist > 0 ? dist : 0,
            mediaPaths: _images.map((e) => e.path).toList(),
            scheduledDate: _scheduledDate,
            timeSlot: _timeSlot,
            lat: _lat,
            lng: _lng,
            partnerLat: _partner?.lat,
            partnerLng: _partner?.lng,
            estimatedAmount: _estimate,
          );
      if (!mounted) return;
      final pts = order.pointsEarned;
      if (pts > 0) await context.read<AuthProvider>().addPoints(pts);
      await NotificationService.instance.show(
        title: 'Buyurtma qabul qilindi',
        body: '#${order.id} · ${_partner?.name ?? 'Hamkor'} · $_timeSlot',
      );
      if (!mounted) return;
      context.go('/order-success', extra: order);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Buyurtmani yuborishda xatolik');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _next() {
    if (_step == 0) {
      if (_partner == null) {
        setState(() => _error = 'Firmani tanlang');
        return;
      }
      setState(() {
        _error = null;
        _step = 1;
      });
      return;
    }
    if (_step == 1) {
      if (!_validateStep1()) return;
      setState(() => _step = 2);
      return;
    }
    _submit();
  }

  Future<void> _addService() async {
    final catalog = context.read<CatalogProvider>().services;
    if (catalog.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Serverdan xizmatlar yo‘q'), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    final selected = await showModalBottomSheet<ServiceModel>(
      context: context,
      backgroundColor: AppColors.surfaceContainer,
      builder: (ctx) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Xizmat qo‘shish', style: Theme.of(ctx).textTheme.headlineMedium),
          const SizedBox(height: 12),
          for (final s in catalog)
            ListTile(
              leading: ServiceBadgeIcon(iconKey: s.icon, accent: Color(s.accent), size: 40, emoji: s.emoji, image: s.image),
              title: Text(s.name),
              subtitle: Text(s.priceLabel),
              onTap: () => Navigator.pop(ctx, s),
            ),
        ],
      ),
    );
    if (selected != null && !_cart.any((e) => e.id == selected.id)) {
      setState(() => _cart.add(selected));
    }
  }

  @override
  Widget build(BuildContext context) {
    final partners = context.watch<HomeFeedProvider>().partners;
    final progress = (_step + 1) / 3;

    return Scaffold(
      appBar: AppBar(
        title: Text(ApiConfig.brandName, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.primary)),
        actions: [IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.close))],
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GrowthProgressBar(progress: progress),
            const SizedBox(height: 14),
            Text(
              switch (_step) {
                0 => 'Firma tanlang',
                1 => 'Manzil, vaqt va rasmlar',
                _ => 'Tasdiqlash',
              },
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 22),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: AppColors.error)),
            ],
            const SizedBox(height: 12),
            Expanded(child: _buildStep(partners)),
            if (_step == 2) ...[
              OutlinedButton.icon(
                onPressed: _submitting ? null : _addService,
                icon: const Icon(Icons.add, color: AppColors.primary),
                label: const Text('Xizmat qo‘shish', style: TextStyle(color: AppColors.primary)),
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              ),
              const SizedBox(height: 8),
            ],
            PrimaryButton(
              label: _step == 2 ? 'Buyurtmani tasdiqlash' : 'Davom etish',
              loading: _submitting,
              onPressed: _submitting ? null : _next,
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildStep(List<PartnerModel> partners) {
    if (_step == 0) {
      if (partners.isEmpty) {
        return const Center(child: Text('Hamkorlar serverdan yuklanmagan', style: TextStyle(color: AppColors.onSurfaceVariant)));
      }
      return ListView(
        children: [
          for (final p in partners)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GlassCard(
                borderRadius: 14,
                onTap: () => setState(() {
                  _partner = p;
                  _error = null;
                }),
                child: Row(
                  children: [
                    PartnerLogo(partner: p, size: 44),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(p.name, style: Theme.of(context).textTheme.titleMedium),
                          Text('${p.activity} · ${p.address}', style: Theme.of(context).textTheme.labelSmall),
                        ],
                      ),
                    ),
                    Icon(
                      _partner?.id == p.id ? Icons.radio_button_checked : Icons.radio_button_off,
                      color: AppColors.primary,
                    ),
                  ],
                ),
              ),
            ),
        ],
      );
    }

    if (_step == 1) {
      return ListView(
        children: [
          TextField(
            controller: _address,
            decoration: InputDecoration(
              labelText: 'Manzil *',
              prefixIcon: const Icon(Icons.place_outlined),
              suffixIcon: IconButton(
                tooltip: 'GPS',
                onPressed: _locating ? null : _detectLocation,
                icon: _locating
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.my_location, color: AppColors.primary),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _area,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Maydon (m²) *', prefixIcon: Icon(Icons.square_foot)),
          ),
          if (_areaM2 > 0) ...[
            const SizedBox(height: 10),
            GlassCard(
              borderRadius: 14,
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  const Icon(Icons.calculate_outlined, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Taxminiy narx: ${PriceCalculator.label(_estimate)}',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          GlassCard(
            borderRadius: 14,
            onTap: _pickDate,
            child: Row(
              children: [
                const Icon(Icons.calendar_month_outlined, color: AppColors.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Sana', style: Theme.of(context).textTheme.labelSmall),
                      Text(DateFormat('d MMM yyyy').format(_scheduledDate),
                          style: Theme.of(context).textTheme.titleMedium),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text('Vaqt oralig‘i', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final slot in _slots)
                ChoiceChip(
                  label: Text(slot),
                  selected: _timeSlot == slot,
                  onSelected: (_) => setState(() => _timeSlot = slot),
                  selectedColor: AppColors.primary.withValues(alpha: 0.28),
                  labelStyle: TextStyle(
                    color: _timeSlot == slot ? AppColors.primary : AppColors.onSurface,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Telefon', prefixIcon: Icon(Icons.phone_outlined)),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notes,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Izoh *',
              hintText: 'Bog‘ holati, muammo, kirish yo‘li...',
              prefixIcon: Icon(Icons.notes),
            ),
          ),
          const SizedBox(height: 16),
          Text('Bog‘ holatidan 2–3 ta rasm *', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          SizedBox(
            height: 92,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final img in _images)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.file(File(img.path), width: 92, height: 92, fit: BoxFit.cover),
                    ),
                  ),
                if (_images.length < 3)
                  InkWell(
                    onTap: _pickImages,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: 92,
                      height: 92,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.primary),
                      ),
                      child: const Icon(Icons.add_a_photo_outlined, color: AppColors.primary),
                    ),
                  ),
              ],
            ),
          ),
        ],
      );
    }

    return ListView(
      children: [
        for (final s in _cart)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: GlassCard(
              child: Row(
                children: [
                  ServiceBadgeIcon(iconKey: s.icon, accent: Color(s.accent), size: 44, emoji: s.emoji, image: s.image),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(s.name, style: Theme.of(context).textTheme.titleMedium),
                        Text(
                          PriceCalculator.label(PriceCalculator.estimateForService(s, _areaM2)),
                          style: const TextStyle(color: AppColors.primary),
                        ),
                      ],
                    ),
                  ),
                  if (_cart.length > 1)
                    IconButton(
                      onPressed: () => setState(() => _cart.removeWhere((e) => e.id == s.id)),
                      icon: const Icon(Icons.close, color: AppColors.error),
                    ),
                ],
              ),
            ),
          ),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Firma: ${_partner?.name ?? '—'}'),
              const SizedBox(height: 6),
              Text('Manzil: ${_address.text}'),
              const SizedBox(height: 6),
              Text('Maydon: ${_area.text} m²'),
              const SizedBox(height: 6),
              Text('Sana: ${DateFormat('d MMM yyyy').format(_scheduledDate)} · $_timeSlot'),
              const SizedBox(height: 6),
              Text('Rasmlar: ${_images.length} ta'),
              const SizedBox(height: 6),
              Text('Izoh: ${_notes.text}', maxLines: 3, overflow: TextOverflow.ellipsis),
              const Divider(height: 20),
              Text(
                'Taxminiy jami: ${PriceCalculator.label(_estimate)}',
                style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
