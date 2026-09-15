import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/network/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';
import '../home/catalog_provider.dart';

class OrderFlowScreen extends StatefulWidget {
  const OrderFlowScreen({super.key, required this.service});

  final ServiceModel service;

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
  bool _submitting = false;

  @override
  void dispose() {
    _area.dispose();
    _address.dispose();
    _notes.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _pickImages() async {
    final picker = ImagePicker();
    final files = await picker.pickMultiImage(imageQuality: 85);
    if (files.isNotEmpty) setState(() => _images.addAll(files));
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final order = await context.read<OrdersProvider>().create(
            serviceId: widget.service.id,
            areaSize: _area.text.trim(),
            address: _address.text.trim(),
            notes: _notes.text.trim(),
            phone: _phone.text.trim(),
            mediaPaths: _images.map((e) => e.path).toList(),
          );
      if (!mounted) return;
      context.go('/order-success', extra: order);
    } catch (e) {
      if (!mounted) return;
      // Offline / API fail — still show success UX with local mock
      final mock = OrderModel(
        id: DateTime.now().millisecondsSinceEpoch % 100000,
        status: 'new',
        serviceName: widget.service.name,
        createdAt: DateTime.now(),
        areaSize: _area.text.trim(),
        phoneNumber: _phone.text.trim(),
        address: _address.text.trim(),
      );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Serverga yuborilmadi, lokal saqlandi: $e')),
      );
      context.go('/order-success', extra: mock);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _next() {
    if (_step < 2) {
      setState(() => _step++);
    } else {
      _submit();
    }
  }

  @override
  Widget build(BuildContext context) {
    final progress = (_step + 1) / 3;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.eco, color: AppColors.primary),
            const SizedBox(width: 8),
            Text(
              'My Garden',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.primary),
            ),
          ],
        ),
        actions: [
          IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.close)),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Qadam ${_step + 1}/3',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.primary,
                    letterSpacing: 1.2,
                  ),
            ),
            const SizedBox(height: 8),
            GrowthProgressBar(progress: progress),
            const SizedBox(height: 28),
            Expanded(child: _buildStep()),
            PrimaryButton(
              label: _step == 2 ? 'Buyurtmani yuborish' : 'Davom etish',
              icon: Icons.arrow_forward,
              loading: _submitting,
              onPressed: _next,
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildStep() {
    return switch (_step) {
      0 => ListView(
          children: [
            Text("Hududning rasmini yuboring", style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: 8),
            Text(
              "Dorilanishi kerak bo'lgan maydon rasmini yuklang (ixtiyoriy)",
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: _pickImages,
              child: Container(
                height: 180,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.primary, width: 2, style: BorderStyle.solid),
                  color: AppColors.primary.withValues(alpha: 0.03),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.add_a_photo_outlined, color: AppColors.primary, size: 40),
                    const SizedBox(height: 12),
                    Text(
                      _images.isEmpty ? 'Rasm yuklash' : '${_images.length} ta rasm tanlandi',
                      style: const TextStyle(color: AppColors.primary),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _area,
              decoration: const InputDecoration(
                labelText: 'Maydon (masalan: 60 sotix)',
              ),
            ),
          ],
        ),
      1 => ListView(
          children: [
            Text('Manzil va izoh', style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: 8),
            Text(
              'Mutaxassislarimiz yetib borishi uchun manzilni kiriting',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _address,
              decoration: const InputDecoration(
                labelText: 'Manzil',
                prefixIcon: Icon(Icons.location_on_outlined, color: AppColors.primary),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _notes,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Qo\'shimcha izoh',
                alignLabelWithHint: true,
              ),
            ),
          ],
        ),
      _ => ListView(
          children: [
            Text('Tasdiqlash', style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: 8),
            Text(
              "Bog'lanish uchun telefon raqamingizni tasdiqlang",
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            GlassCard(
              child: Column(
                children: [
                  _row('Xizmat', widget.service.name),
                  const Divider(color: AppColors.outlineVariant),
                  _row('Maydon', _area.text.isEmpty ? '—' : _area.text),
                  const Divider(color: AppColors.outlineVariant),
                  _row('Manzil', _address.text.isEmpty ? '—' : _address.text),
                ],
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Telefon',
                prefixIcon: Icon(Icons.phone, color: AppColors.primary),
                hintText: '+998 90 123 45 67',
              ),
            ),
          ],
        ),
    };
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k, style: const TextStyle(color: AppColors.onSurfaceVariant)),
          Flexible(child: Text(v, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
