import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
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

class OrderFlowArgs {
  const OrderFlowArgs({required this.service, this.partner});

  final ServiceModel service;

  /// Xizmat sahifasida tanlangan firma (`offer` — firma narxi bilan).
  final PartnerModel? partner;
}

class OrderFlowScreen extends StatefulWidget {
  const OrderFlowScreen({super.key, required this.service, this.initialPartner});

  final ServiceModel service;
  final PartnerModel? initialPartner;

  @override
  State<OrderFlowScreen> createState() => _OrderFlowScreenState();
}

class _OrderFlowScreenState extends State<OrderFlowScreen> {
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
  TimeSlotModel? _slot;
  List<TimeSlotModel>? _daySlots;
  bool _slotsLoading = false;
  String? _slotsNote;
  int _slotsRequest = 0;
  double? _lat;
  double? _lng;

  /// Shu ekrandagi barcha yuborish urinishlari uchun bitta kalit — javob yo'qolib qayta bosilsa,
  /// server ikkinchi buyurtma ochmaydi.
  late final String _idempotencyKey = () {
    final rnd = Random.secure();
    return List.generate(16, (_) => rnd.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  }();

  /// Xizmatni ko'rsatadigan firmalar (`offer.price` — qat'iy narx). null — yuklanmoqda.
  List<PartnerModel>? _firms;
  bool _firmsHavePrices = false;
  String? _firmsError;

  /// Savatdagi har bir xizmat uchun tanlangan firmaning narxi.
  final _prices = <int, int>{};
  bool _addingService = false;

  @override
  void initState() {
    super.initState();
    _cart.add(widget.service);
    _area.addListener(() => setState(() {}));
    final initial = widget.initialPartner;
    if (initial != null) _selectPartner(initial);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = context.read<AuthProvider>().user;
      final phone = user?.phone ?? '';
      if (phone.isNotEmpty) {
        _phone.text = phone.replaceFirst('+998', '').replaceAll(' ', '');
      }
      if (user?.address.isNotEmpty == true) {
        _address.text = user!.address;
      }
      final feed = context.read<HomeFeedProvider>();
      _lat = feed.userLat;
      _lng = feed.userLng;
      _loadFirms();
    });
  }

  Future<void> _loadFirms() async {
    final feed = context.read<HomeFeedProvider>();
    setState(() {
      _firms = null;
      _firmsError = null;
    });
    try {
      final firms = await feed.partnersForService(context.read<ApiClient>(), widget.service.id);
      firms.sort((a, b) => (a.offer?.price ?? 0).compareTo(b.offer?.price ?? 0));
      if (!mounted) return;
      setState(() {
        _firms = firms;
        _firmsHavePrices = firms.any((f) => f.offer != null);
        if (_partner == null && firms.length == 1) _selectPartner(firms.first);
        if (_partner != null) {
          final fresh = firms.where((f) => f.id == _partner!.id).firstOrNull;
          if (fresh != null && fresh.offer != null) _selectPartner(fresh);
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _firms = List.of(feed.partners);
        _firmsHavePrices = false;
        _firmsError = 'Firmalar narxini yuklab bo‘lmadi';
      });
    }
  }

  void _selectPartner(PartnerModel p) {
    final changed = _partner?.id != p.id;
    _partner = p;
    _error = null;
    if (changed) {
      _cart
        ..clear()
        ..add(widget.service);
      _prices.clear();
    }
    final price = p.offer?.price;
    if (price != null && price > 0) _prices[widget.service.id] = price;
  }

  /// Firma qat'iy narx belgilagan — maydon bo'yicha taxmin kerak emas.
  bool get _fixedPricing => _partner?.offer != null && _prices.containsKey(widget.service.id);

  @override
  void dispose() {
    _area.dispose();
    _address.dispose();
    _notes.dispose();
    _phone.dispose();
    super.dispose();
  }

  double get _areaM2 => double.tryParse(_area.text.trim().replaceAll(',', '.')) ?? 0;

  int get _estimate => _fixedPricing
      ? _cart.fold<int>(0, (s, e) => s + (_prices[e.id] ?? 0))
      : PriceCalculator.estimateCart(_cart, _areaM2);

  String _priceFor(ServiceModel s) {
    final fixed = _prices[s.id];
    if (_fixedPricing && fixed != null) return '${ServiceModel.formatMoney(fixed)} so‘m';
    return PriceCalculator.label(PriceCalculator.estimateForService(s, _areaM2));
  }

  Future<void> _pickImages() async {
    final List<XFile> files;
    try {
      files = await ImagePicker().pickMultiImage(imageQuality: 80, maxWidth: 1920, maxHeight: 1920);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Rasm tanlab bo‘lmadi. Galereya ruxsatini tekshiring'), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    if (files.isEmpty || !mounted) return;
    setState(() {
      _error = null;
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

  Future<void> _scanArea() async {
    FocusScope.of(context).unfocus();
    final m2 = await context.push<int>('/area-scan');
    if (!mounted || m2 == null || m2 <= 0) return;
    setState(() {
      _area.text = '$m2';
      _error = null;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Maydon o‘lchandi: $m2 m²'), behavior: SnackBarBehavior.floating),
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _scheduledDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 60)),
    );
    if (picked == null) return;
    setState(() => _scheduledDate = picked);
    _loadSlots();
  }

  String get _dateParam =>
      '${_scheduledDate.year.toString().padLeft(4, '0')}-${_scheduledDate.month.toString().padLeft(2, '0')}-${_scheduledDate.day.toString().padLeft(2, '0')}';

  /// Tanlangan firmaning shu kundagi bandligi. Firma yo'q bo'lsa — oddiy ish soatlari.
  Future<void> _loadSlots() async {
    final request = ++_slotsRequest;
    final partner = _partner;
    setState(() {
      _slotsLoading = true;
      _slotsNote = null;
    });
    List<TimeSlotModel> slots;
    String? note;
    if (partner == null || !partner.fromServer || ApiConfig.useLocalData) {
      slots = TimeSlotModel.workingHours(_scheduledDate);
      note = partner == null ? 'Firma operator tomonidan biriktiriladi — vaqtni u tasdiqlaydi' : null;
    } else {
      try {
        final data = await context.read<ApiClient>().get(
          '/partners/${partner.id}/availability/',
          auth: false,
          query: {'date': _dateParam},
        );
        final raw = (data is Map ? data['slots'] : null) as List? ?? const [];
        slots = [for (final s in raw) TimeSlotModel.fromJson(Map<String, dynamic>.from(s as Map))];
      } catch (_) {
        slots = TimeSlotModel.workingHours(_scheduledDate);
        note = 'Firma bandligini yuklab bo‘lmadi — vaqtni firma tasdiqlaydi';
      }
    }
    if (!mounted || request != _slotsRequest) return;
    setState(() {
      _daySlots = slots;
      _slotsNote = note;
      _slotsLoading = false;
      final keep = _slot == null ? null : slots.where((s) => s.start == _slot!.start && s.isFree).firstOrNull;
      _slot = keep;
    });
  }

  bool _validateStep1() {
    if (_address.text.trim().isEmpty) {
      setState(() => _error = 'Manzil majburiy');
      return false;
    }
    if (!_fixedPricing && _area.text.trim().isEmpty) {
      setState(() => _error = 'Maydon majburiy — narx maydonga qarab hisoblanadi');
      return false;
    }
    if (_notes.text.trim().isEmpty) {
      setState(() => _error = 'Izoh majburiy — bog‘ holatini yozing');
      return false;
    }
    if (_slot == null) {
      setState(() => _error = 'Bo‘sh (yashil) vaqtni tanlang');
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
            idempotencyKey: _idempotencyKey,
            phone: _phone.text.trim(),
            partnerName: _partner?.name ?? '',
            firmId: _partner != null && _partner!.fromServer ? _partner!.id : null,
            distanceKm: dist > 0 ? dist : 0,
            media: List.of(_images),
            scheduledDate: _scheduledDate,
            timeSlot: _slot?.label ?? '',
            scheduledStart: _slot?.start,
            lat: _lat,
            lng: _lng,
            partnerLat: _partner?.lat,
            partnerLng: _partner?.lng,
            estimatedAmount: _estimate,
          );
      await NotificationService.instance.show(
        title: 'Buyurtma qabul qilindi',
        body: order.needsPayment
            ? "#${order.id} · To'lovni amalga oshiring"
            : '#${order.id} · ${_partner?.name ?? 'Hamkor'} · ${order.timeSlot}',
      );
      if (!mounted) return;
      context.go(order.needsPayment ? '/order-payment' : '/order-success', extra: order);
    } on ApiException catch (e) {
      if (e.code != null && e.code!.startsWith('slot_')) {
        // Shu orada boshqa mijoz vaqtni band qildi — jadvalni yangilab, vaqt tanlashga qaytaramiz.
        setState(() {
          _error = e.message;
          _slot = null;
          _step = 1;
        });
        _loadSlots();
        return;
      }
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Buyurtmani yuborishda xatolik');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _next() {
    if (_step == 0) {
      if (_firms == null) return;
      // Hech bir firma xizmatni ko'rsatmasa — buyurtmani operator firmaga biriktiradi.
      if (_partner == null && _firms!.isNotEmpty) {
        setState(() => _error = 'Firmani tanlang');
        return;
      }
      setState(() {
        _error = null;
        _step = 1;
      });
      _loadSlots();
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
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.paddingOf(ctx).bottom),
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
    if (selected == null || _cart.any((e) => e.id == selected.id) || !mounted) return;
    if (!_fixedPricing) {
      setState(() => _cart.add(selected));
      return;
    }
    setState(() => _addingService = true);
    final price = await context.read<CatalogProvider>().firmPrice(selected, _partner!.id);
    if (!mounted) return;
    setState(() => _addingService = false);
    if (price == null || price <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${_partner!.name} “${selected.name}” xizmatini ko‘rsatmaydi'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() {
      _prices[selected.id] = price;
      _cart.add(selected);
    });
  }

  @override
  Widget build(BuildContext context) {
    final partners = _firms ?? const <PartnerModel>[];
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
                onPressed: _submitting || _addingService ? null : _addService,
                icon: _addingService
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.add, color: AppColors.primary),
                label: const Text('Xizmat qo‘shish', style: TextStyle(color: AppColors.primary)),
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              ),
              const SizedBox(height: 8),
            ],
            PrimaryButton(
              label: _step == 2
                  ? (_estimate > 0 ? 'Tasdiqlash va to‘lovga o‘tish' : 'Buyurtmani tasdiqlash')
                  : 'Davom etish',
              loading: _submitting,
              onPressed: _submitting ? null : _next,
            ),
            SizedBox(height: 16 + MediaQuery.paddingOf(context).bottom),
          ],
        ),
      ),
    );
  }

  static const _freeColor = Color(0xFF43A047);
  static const _busyColor = Color(0xFFE53935);

  Widget _legendDot(Color color, String text) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 4),
      Text(text, style: const TextStyle(fontSize: 11, color: AppColors.onSurfaceVariant)),
    ],
  );

  Widget _buildSlotPicker(BuildContext context) {
    final slots = _daySlots;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('Boshlanish vaqti', style: Theme.of(context).textTheme.titleMedium)),
            _legendDot(_freeColor, 'Bo‘sh'),
            const SizedBox(width: 10),
            _legendDot(_busyColor, 'Band'),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          'Xizmat taxminan 1 soat davom etadi. Ish cho‘zilsa, firma vaqtni uzaytiradi.',
          style: TextStyle(fontSize: 11, color: AppColors.onSurfaceVariant),
        ),
        const SizedBox(height: 8),
        if (_slotsLoading && slots == null)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          )
        else if (slots != null)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [for (final slot in slots) _slotTile(slot)],
          ),
        if (_slotsNote != null) ...[
          const SizedBox(height: 6),
          Text(_slotsNote!, style: const TextStyle(fontSize: 11, color: AppColors.onSurfaceVariant)),
        ],
      ],
    );
  }

  Widget _slotTile(TimeSlotModel slot) {
    final selected = _slot?.start == slot.start;
    final color = slot.isFree ? _freeColor : (slot.isBusy ? _busyColor : AppColors.outlineVariant);
    final caption = slot.isBusy
        ? 'Band'
        : !slot.isFree
            ? 'O‘tgan'
            : slot.capacity > 1
                ? 'Bo‘sh ${slot.capacity - slot.busyCount}/${slot.capacity}'
                : 'Bo‘sh';
    return Opacity(
      opacity: slot.isFree ? 1 : 0.75,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: slot.isFree
            ? () => setState(() {
                  _slot = slot;
                  _error = null;
                })
            : () => ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(slot.isBusy
                        ? '${slot.label} vaqtida firma band — boshqa vaqtni tanlang'
                        : 'Bu vaqt o‘tib ketgan'),
                    behavior: SnackBarBehavior.floating,
                    duration: const Duration(seconds: 2),
                  ),
                ),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 98,
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: color.withValues(alpha: selected ? 0.45 : 0.16),
            border: Border.all(color: color, width: selected ? 2 : 1),
          ),
          child: Column(
            children: [
              Text(
                slot.start,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                  color: slot.isFree || slot.isBusy ? Colors.white : AppColors.onSurfaceVariant,
                  decoration: slot.isBusy ? TextDecoration.lineThrough : null,
                ),
              ),
              Text(caption, style: TextStyle(fontSize: 11, color: slot.isFree || slot.isBusy ? color : AppColors.outline)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStep(List<PartnerModel> partners) {
    if (_step == 0) {
      if (_firms == null) {
        return const Center(child: CircularProgressIndicator(color: AppColors.primary));
      }
      if (partners.isEmpty) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.storefront_outlined, size: 48, color: AppColors.onSurfaceVariant),
                const SizedBox(height: 12),
                Text(
                  '“${widget.service.name}” xizmatini hozircha hech bir firma tasdiqlangan narx bilan ko‘rsatmaydi.\n'
                  'Buyurtma qoldiring — E-Makon operatori mos firmani biriktiradi.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.onSurfaceVariant, height: 1.4),
                ),
              ],
            ),
          ),
        );
      }
      final feed = context.watch<HomeFeedProvider>();
      return RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _loadFirms,
        child: ListView(
          children: [
            if (_firmsError != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, size: 16, color: AppColors.onSurfaceVariant),
                    const SizedBox(width: 6),
                    Expanded(child: Text(_firmsError!, style: Theme.of(context).textTheme.labelSmall)),
                    TextButton(onPressed: _loadFirms, child: const Text('Qayta')),
                  ],
                ),
              )
            else if (_firmsHavePrices)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  '${partners.length} ta firma bu xizmatni ko‘rsatadi · narxlar qat’iy',
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ),
            for (final p in partners) _firmTile(p, feed.distanceKm(p)),
          ],
        ),
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
            decoration: InputDecoration(
              labelText: _fixedPricing ? 'Maydon (m², ixtiyoriy)' : 'Maydon (m²) *',
              prefixIcon: const Icon(Icons.square_foot),
              suffixIcon: IconButton(
                tooltip: 'Kamera bilan o‘lchash',
                onPressed: _scanArea,
                icon: const Icon(Icons.photo_camera_outlined, color: AppColors.primary),
              ),
            ),
          ),
          if (_area.text.trim().isEmpty) ...[
            const SizedBox(height: 8),
            GlassCard(
              borderRadius: 14,
              padding: const EdgeInsets.all(12),
              onTap: _scanArea,
              child: const Row(
                children: [
                  Icon(Icons.crop_free, color: AppColors.primary),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Maydonni bilmaysizmi?', style: TextStyle(fontWeight: FontWeight.w700)),
                        SizedBox(height: 2),
                        Text(
                          'Kamerani yoqib hovlini aylanib chiqing — dastur m² ni o‘zi hisoblaydi',
                          style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 12.5),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: AppColors.primary),
                ],
              ),
            ),
          ],
          if (_fixedPricing) ...[
            const SizedBox(height: 10),
            GlassCard(
              borderRadius: 14,
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  const Icon(Icons.sell_outlined, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '${_partner!.name} narxi: ${ServiceModel.formatMoney(_estimate)} so‘m (qat’iy)',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (_areaM2 > 0) ...[
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
          _buildSlotPicker(context),
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
          Text('Bog‘ holatidan rasmlar (ixtiyoriy, maks. 3)', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          SizedBox(
            height: 92,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final img in _images)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: kIsWeb
                              ? Image.network(img.path, width: 92, height: 92, fit: BoxFit.cover)
                              : Image.file(File(img.path), width: 92, height: 92, fit: BoxFit.cover),
                        ),
                        Positioned(
                          top: 4,
                          right: 4,
                          child: Material(
                            color: Colors.black54,
                            shape: const CircleBorder(),
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: () => setState(() => _images.remove(img)),
                              child: const Padding(
                                padding: EdgeInsets.all(4),
                                child: Icon(Icons.close_rounded, size: 16, color: Colors.white),
                              ),
                            ),
                          ),
                        ),
                      ],
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
                        Text(_priceFor(s), style: const TextStyle(color: AppColors.primary)),
                      ],
                    ),
                  ),
                  if (_cart.length > 1 && s.id != widget.service.id)
                    IconButton(
                      onPressed: () => setState(() {
                        _cart.removeWhere((e) => e.id == s.id);
                        _prices.remove(s.id);
                      }),
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
              Text('Firma: ${_partner?.name ?? 'Operator biriktiradi'}'),
              const SizedBox(height: 6),
              Text('Manzil: ${_address.text}'),
              const SizedBox(height: 6),
              if (_area.text.trim().isNotEmpty) ...[
                Text('Maydon: ${_area.text} m²'),
                const SizedBox(height: 6),
              ],
              Text('Sana: ${DateFormat('d MMM yyyy').format(_scheduledDate)} · ${_slot?.label ?? '—'}'),
              const SizedBox(height: 6),
              Text('Rasmlar: ${_images.length} ta'),
              const SizedBox(height: 6),
              Text('Izoh: ${_notes.text}', maxLines: 3, overflow: TextOverflow.ellipsis),
              const Divider(height: 20),
              Text(
                _fixedPricing
                    ? 'Jami: ${ServiceModel.formatMoney(_estimate)} so‘m'
                    : 'Taxminiy jami: ${PriceCalculator.label(_estimate)}',
                style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary),
              ),
              if (_fixedPricing)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Firma belgilagan qat’iy narx · to‘lov ish yakunlanguncha E-Makon hisobida saqlanadi',
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _firmTile(PartnerModel p, double distanceKm) {
    final selected = _partner?.id == p.id;
    final price = p.offer?.price;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        borderRadius: 14,
        onTap: () => setState(() => _selectPartner(p)),
        child: Row(
          children: [
            PartnerLogo(partner: p, size: 44),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.name, style: Theme.of(context).textTheme.titleMedium, overflow: TextOverflow.ellipsis),
                  Text(
                    [
                      '★ ${p.rating.toStringAsFixed(1)}',
                      if (distanceKm >= 0) '${distanceKm.toStringAsFixed(1)} km',
                      if (p.offer?.duration.isNotEmpty == true) p.offer!.duration else if (p.address.isNotEmpty) p.address,
                    ].join(' · '),
                    style: Theme.of(context).textTheme.labelSmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (price != null && price > 0)
                    Text(
                      '${ServiceModel.formatMoney(price)} so‘m',
                      style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800),
                    ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Firma haqida',
              onPressed: () => showPartnerSheet(context, p, distanceKm: distanceKm),
              icon: const Icon(Icons.info_outline, color: AppColors.onSurfaceVariant),
            ),
            Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, color: AppColors.primary),
          ],
        ),
      ),
    );
  }
}
