import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../data/services_data.dart';
import '../../models/order.dart';
import '../../models/service.dart';
import '../../providers/app_state.dart';
import '../../widgets/order_progress_header.dart';
import 'order_success_screen.dart';
import '../auth/phone_auth_screen.dart';
import '../profile/edit_profile_screen.dart';

class OrderFlowScreen extends StatefulWidget {
  const OrderFlowScreen({super.key, this.preselectedServiceId});

  final String? preselectedServiceId;

  @override
  State<OrderFlowScreen> createState() => _OrderFlowScreenState();
}

class _OrderFlowScreenState extends State<OrderFlowScreen> {
  static const _totalSteps = 3;

  int _step = 0;
  String? _selectedServiceId;
  bool _isUploadingPhoto = false;
  final _addressController = TextEditingController();
  final _areaController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _notesController = TextEditingController();
  String? _photoPath;
  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _selectedServiceId =
        widget.preselectedServiceId ?? kServices.first.id;
    _fillFromProfile();
  }

  void _fillFromProfile() {
    final state = context.read<AppState>();
    if (state.phone != null) _phoneController.text = state.phone!;
    _firstNameController.text = state.profile.firstName;
    _lastNameController.text = state.profile.lastName;
    _addressController.text = state.profile.formattedAddress.isNotEmpty
        ? state.profile.formattedAddress
        : state.profile.homeAddress;
  }

  @override
  void dispose() {
    _addressController.dispose();
    _areaController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  GardenService? get _selectedService =>
      _selectedServiceId != null ? findServiceById(_selectedServiceId!) : null;

  bool _canProceed() {
    switch (_step) {
      case 0:
        return !_isUploadingPhoto;
      case 1:
        return true;
      case 2:
        final phone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
        return phone.length >= 12;
      default:
        return false;
    }
  }

  Future<void> _pickPhoto() async {
    setState(() => _isUploadingPhoto = true);
    try {
      final image = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1200,
        imageQuality: 80,
      );
      if (image != null) {
        setState(() => _photoPath = image.path);
        if (mounted) {
          context.read<AppState>().notifyOrderStep('Rasm qo\'shildi');
        }
      }
    } finally {
      if (mounted) setState(() => _isUploadingPhoto = false);
    }
  }

  void _goNext() {
    final state = context.read<AppState>();

    if (_step == 0) {
      state.notifyOrderStep('Rasm bosqichi');
    } else if (_step == 1) {
      state.notifyOrderStep('Maydon kiritildi');
    }

    if (_step < _totalSteps - 1) {
      setState(() => _step++);
    } else {
      _submit();
    }
  }

  void _skipPhoto() {
    context.read<AppState>().notifyOrderStep('Rasm o\'tkazib yuborildi');
    setState(() => _step++);
  }

  void _skipArea() {
    context.read<AppState>().notifyOrderStep('Maydon o\'tkazib yuborildi');
    setState(() => _step++);
  }

  void _submit() {
    final state = context.read<AppState>();

    if (!state.isAuthenticated) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const PhoneAuthScreen()),
      );
      return;
    }

    final validationError = state.validateForOrder(
      firstName: _firstNameController.text,
      lastName: _lastNameController.text,
      address: _addressController.text.isNotEmpty
          ? _addressController.text
          : state.profile.formattedAddress.isNotEmpty
              ? state.profile.formattedAddress
              : state.profile.homeAddress,
    );

    if (validationError != null) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Ma\'lumotlar to\'liq emas'),
          content: Text(
            '$validationError\n\nSo\'rov yuborish uchun ism, familiya va uy manzili aniq kiritilgan bo\'lishi kerak.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Bekor qilish'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                );
              },
              child: const Text(AppStrings.editProfile),
            ),
          ],
        ),
      );
      return;
    }

    final service = _selectedService!;
    final fullName =
        '${_firstNameController.text.trim()} ${_lastNameController.text.trim()}';

    final address = _addressController.text.trim().isNotEmpty
        ? _addressController.text.trim()
        : state.profile.formattedAddress.trim().isNotEmpty
            ? state.profile.formattedAddress.trim()
            : state.profile.homeAddress.trim();

    final order = GardenOrder(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      serviceId: service.id,
      serviceName: service.name,
      address: address,
      area: _areaController.text.trim(),
      customerName: fullName,
      phone: _phoneController.text.trim(),
      notes: _notesController.text.trim().isEmpty
          ? null
          : _notesController.text.trim(),
      photoPath: _photoPath,
    );

    state.addOrder(order);

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => OrderSuccessScreen(order: order),
      ),
    );
  }

  String? get _stepStatusText {
    if (_step == 0 && _isUploadingPhoto) return AppStrings.orderUploading;
    if (_step == 1) return AppStrings.orderAreaStatus;
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: SafeArea(
        child: Column(
          children: [
            if (_step < 2)
              OrderProgressHeader(
                currentStep: _step,
                totalSteps: _totalSteps,
                statusText: _stepStatusText,
              )
            else
              OrderFinalStepHeader(
                totalSteps: _totalSteps,
                onBack: () => setState(() => _step--),
              ),
            Expanded(child: _buildStepContent()),
            _buildBottomBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case 0:
        return _buildPhotoStep();
      case 1:
        return _buildAreaStep();
      case 2:
        return _buildContactStep();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildPhotoStep() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 16),
      children: [
        Text(
          AppStrings.orderPhotoTitle,
          style: GoogleFonts.inter(
            fontSize: 28,
            fontWeight: FontWeight.w700,
            color: AppColors.darkText,
            height: 1.2,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          AppStrings.orderPhotoSubtitle,
          style: GoogleFonts.inter(
            fontSize: 14,
            color: AppColors.accentGreen,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 28),
        DashedUploadArea(
          onTap: _isUploadingPhoto ? null : _pickPhoto,
          child: _photoPath != null
              ? _buildPhotoPreview()
              : _buildUploadPrompt(),
        ),
        const SizedBox(height: 20),
        _buildPhotoTip(),
      ],
    );
  }

  Widget _buildUploadPrompt() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: AppColors.accentGreen,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: AppColors.accentGreen.withValues(alpha: 0.35),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: _isUploadingPhoto
              ? const Padding(
                  padding: EdgeInsets.all(18),
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: AppColors.white,
                  ),
                )
              : const Icon(
                  Icons.photo_camera_outlined,
                  color: AppColors.white,
                  size: 30,
                ),
        ),
        const SizedBox(height: 16),
        Text(
          AppStrings.orderUploadPhoto,
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.accentGreen,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          AppStrings.orderPhotoMaxSize,
          style: GoogleFonts.inter(
            fontSize: 12,
            color: AppColors.darkMuted,
          ),
        ),
      ],
    );
  }

  Widget _buildPhotoPreview() {
    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Image.file(
            File(_photoPath!),
            height: 200,
            width: double.infinity,
            fit: BoxFit.cover,
          ),
        ),
        const SizedBox(height: 16),
        TextButton.icon(
          onPressed: _isUploadingPhoto ? null : _pickPhoto,
          icon: const Icon(Icons.refresh_rounded, size: 18),
          label: Text(
            'Boshqa rasm tanlash',
            style: GoogleFonts.inter(fontWeight: FontWeight.w600),
          ),
          style: TextButton.styleFrom(foregroundColor: AppColors.accentGreen),
        ),
      ],
    );
  }

  Widget _buildPhotoTip() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.darkBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.accentGreen.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.location_on_outlined,
              color: AppColors.accentGreen,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              AppStrings.orderPhotoTip,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppColors.darkTextSecondary,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAreaStep() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 16),
      children: [
        Text(
          AppStrings.orderAreaTitle,
          style: GoogleFonts.inter(
            fontSize: 28,
            fontWeight: FontWeight.w700,
            color: AppColors.darkText,
            height: 1.2,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          AppStrings.orderAreaSubtitle,
          style: GoogleFonts.inter(
            fontSize: 14,
            color: AppColors.accentGreen.withValues(alpha: 0.85),
            height: 1.5,
          ),
        ),
        const SizedBox(height: 28),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.darkCard,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.darkBorder),
          ),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.darkSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.accentGreen.withValues(alpha: 0.6),
              ),
            ),
            child: TextField(
              controller: _areaController,
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                color: AppColors.darkText,
              ),
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: AppStrings.orderAreaHint,
                hintStyle: GoogleFonts.inter(
                  fontSize: 18,
                  color: AppColors.darkMuted.withValues(alpha: 0.6),
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 18),
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        _buildAreaTip(),
      ],
    );
  }

  Widget _buildAreaTip() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.darkBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.accentGreen.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.info_outline_rounded,
              color: AppColors.accentGreen,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              AppStrings.orderAreaTip,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppColors.accentGreen.withValues(alpha: 0.9),
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContactStep() {
    final service = _selectedService;
    final previewUrl = service?.heroImageUrl;

    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
      children: [
        _buildOrderPreviewImage(previewUrl),
        const SizedBox(height: 24),
        Text(
          AppStrings.orderPhoneTitle,
          style: GoogleFonts.inter(
            fontSize: 26,
            fontWeight: FontWeight.w700,
            color: AppColors.darkText,
            height: 1.25,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          AppStrings.orderPhoneSubtitle,
          style: GoogleFonts.inter(
            fontSize: 14,
            color: AppColors.darkMuted,
            height: 1.55,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          AppStrings.orderPhoneLabel,
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.accentGreen,
          ),
        ),
        const SizedBox(height: 8),
        _buildPhoneField(),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: _canProceed() ? _submit : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF0F0F0),
              foregroundColor: AppColors.darkBg,
              disabledBackgroundColor:
                  const Color(0xFFF0F0F0).withValues(alpha: 0.5),
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.send_rounded,
                  size: 20,
                  color:
                      _canProceed() ? AppColors.darkBg : AppColors.darkMuted,
                ),
                const SizedBox(width: 10),
                Flexible(
                  child: Text(
                    AppStrings.orderSubmitPhone,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color:
                          _canProceed() ? AppColors.darkBg : AppColors.darkMuted,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.info_outline_rounded,
              size: 16,
              color: AppColors.darkMuted.withValues(alpha: 0.8),
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                AppStrings.orderContactSoon,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: AppColors.darkMuted,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildOrderPreviewImage(String? fallbackUrl) {
    return Container(
      height: 160,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.darkBorder),
        color: AppColors.darkCard,
      ),
      clipBehavior: Clip.antiAlias,
      child: _photoPath != null
          ? Image.file(
              File(_photoPath!),
              fit: BoxFit.cover,
              width: double.infinity,
            )
          : fallbackUrl != null
              ? Image.network(
                  fallbackUrl,
                  fit: BoxFit.cover,
                  width: double.infinity,
                )
              : Container(
                  color: AppColors.darkSurface,
                  child: const Icon(
                    Icons.landscape_rounded,
                    size: 48,
                    color: AppColors.accentGreen,
                  ),
                ),
    );
  }

  Widget _buildPhoneField() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.darkSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.darkBorder),
      ),
      child: Row(
        children: [
          const Padding(
            padding: EdgeInsets.only(left: 16),
            child: Icon(
              Icons.phone_android_outlined,
              color: AppColors.accentGreen,
              size: 20,
            ),
          ),
          Expanded(
            child: TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: AppColors.darkText,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[\d\s\+]')),
                _OrderPhoneFormatter(),
              ],
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: '+998 90 123 45 67',
                hintStyle: GoogleFonts.inter(
                  color: AppColors.darkMuted.withValues(alpha: 0.5),
                ),
                border: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    if (_step == 0 || _step == 1) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _step == 0 && _isUploadingPhoto
                    ? null
                    : (_step == 0 ? _skipPhoto : _skipArea),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.darkText,
                  side: const BorderSide(color: AppColors.darkBorder),
                  minimumSize: const Size(0, 54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: Text(
                  AppStrings.orderSkip,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: _canProceed() ? _goNext : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accentGreen,
                  foregroundColor: AppColors.darkBg,
                  disabledBackgroundColor:
                      AppColors.accentGreen.withValues(alpha: 0.35),
                  minimumSize: const Size(0, 54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      AppStrings.next,
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Icon(Icons.arrow_forward_rounded, size: 20),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (_step == 2) return const SizedBox.shrink();

    return const SizedBox.shrink();
  }
}

class _OrderPhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('998')) {
      digits = digits.substring(3);
    }
    digits = digits.substring(0, digits.length.clamp(0, 9));

    final buffer = StringBuffer('+998');
    if (digits.isNotEmpty) buffer.write(' ');
    for (var i = 0; i < digits.length; i++) {
      if (i == 2 || i == 5 || i == 7) buffer.write(' ');
      buffer.write(digits[i]);
    }

    final formatted = buffer.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
