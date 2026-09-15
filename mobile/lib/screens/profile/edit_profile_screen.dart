import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../models/user_profile.dart';
import '../../providers/app_state.dart';
import '../../widgets/glass_button.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _firstNameController;
  late final TextEditingController _lastNameController;
  late final TextEditingController _countryController;
  late final TextEditingController _regionController;
  late final TextEditingController _districtController;
  late final TextEditingController _streetController;
  final List<TextEditingController> _extraPhoneControllers = [];
  final _picker = ImagePicker();

  DateTime? _birthDate;
  String? _avatarPath;
  double? _lat;
  double? _lng;
  bool _loadingLocation = false;

  @override
  void initState() {
    super.initState();
    final profile = context.read<AppState>().profile;
    _firstNameController = TextEditingController(text: profile.firstName);
    _lastNameController = TextEditingController(text: profile.lastName);
    _countryController = TextEditingController(text: profile.country);
    _regionController = TextEditingController(text: profile.region);
    _districtController = TextEditingController(text: profile.district);
    _streetController = TextEditingController(text: profile.street);
    _birthDate = profile.birthDate;
    _avatarPath = profile.avatarPath;
    _lat = profile.locationLat;
    _lng = profile.locationLng;
    for (final phone in profile.additionalPhones) {
      _extraPhoneControllers.add(TextEditingController(text: phone));
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _countryController.dispose();
    _regionController.dispose();
    _districtController.dispose();
    _streetController.dispose();
    for (final c in _extraPhoneControllers) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    final image = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 600,
      imageQuality: 85,
    );
    if (image != null) setState(() => _avatarPath = image.path);
  }

  Future<void> _pickBirthDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(1995, 1, 1),
      firstDate: DateTime(1940),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppColors.accentGreen,
              surface: AppColors.darkSurface,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) setState(() => _birthDate = picked);
  }

  Future<void> _fetchLocation() async {
    setState(() => _loadingLocation = true);

    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Joylashuv uchun ruxsat berilmadi')),
        );
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      _lat = position.latitude;
      _lng = position.longitude;

      try {
        final placemarks = await placemarkFromCoordinates(
          position.latitude,
          position.longitude,
        );
        if (placemarks.isNotEmpty) {
          final p = placemarks.first;
          setState(() {
            _countryController.text = p.country ?? "O'zbekiston";
            _regionController.text = p.administrativeArea ?? '';
            _districtController.text =
                p.subAdministrativeArea ?? p.locality ?? '';
            _streetController.text = [
              p.thoroughfare,
              p.subThoroughfare,
              p.street,
            ].where((e) => e != null && e.isNotEmpty).join(' ');
          });
        }
      } catch (_) {}

      if (!mounted) return;
      final address = [
        _countryController.text,
        _regionController.text,
        _districtController.text,
        _streetController.text,
      ].where((e) => e.trim().isNotEmpty).join(', ');

      context.read<AppState>().notifyLocationObtained(address);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Joylashuv olinmadi: $e')),
      );
    } finally {
      if (mounted) setState(() => _loadingLocation = false);
    }
  }

  void _addExtraPhone() {
    setState(() {
      _extraPhoneControllers.add(TextEditingController(text: '+998 '));
    });
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;

    final fullAddress = [
      _countryController.text.trim(),
      _regionController.text.trim(),
      _districtController.text.trim(),
      _streetController.text.trim(),
    ].where((p) => p.isNotEmpty).join(', ');

    final profile = UserProfile(
      firstName: _firstNameController.text.trim(),
      lastName: _lastNameController.text.trim(),
      birthDate: _birthDate,
      avatarPath: _avatarPath,
      homeAddress: fullAddress,
      country: _countryController.text.trim(),
      region: _regionController.text.trim(),
      district: _districtController.text.trim(),
      street: _streetController.text.trim(),
      locationLat: _lat,
      locationLng: _lng,
      additionalPhones: _extraPhoneControllers
          .map((c) => c.text.trim())
          .where((p) => p.isNotEmpty)
          .toList(),
    );

    context.read<AppState>().updateProfile(profile);
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Profil saqlandi')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: Text(
          AppStrings.editProfile,
          style: GoogleFonts.inter(fontWeight: FontWeight.w600),
        ),
        backgroundColor: AppColors.darkBg,
        actions: [
          TextButton(
            onPressed: _save,
            child: Text(
              AppStrings.save,
              style: GoogleFonts.inter(
                fontWeight: FontWeight.w600,
                color: AppColors.mintGreen,
              ),
            ),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Center(
              child: GestureDetector(
                onTap: _pickAvatar,
                child: Stack(
                  children: [
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.accentGreen, width: 3),
                        image: _avatarPath != null
                            ? DecorationImage(
                                image: FileImage(File(_avatarPath!)),
                                fit: BoxFit.cover,
                              )
                            : null,
                        color: AppColors.darkSurface,
                      ),
                      child: _avatarPath == null
                          ? const Icon(
                              Icons.camera_alt_outlined,
                              color: AppColors.mintGreen,
                              size: 32,
                            )
                          : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                          color: AppColors.accentGreen,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.edit, size: 14, color: AppColors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Center(
              child: Text(
                AppStrings.tapToAddPhoto,
                style: GoogleFonts.inter(fontSize: 12, color: AppColors.darkMuted),
              ),
            ),
            const SizedBox(height: 24),
            _sectionTitle(AppStrings.personalInfo),
            const SizedBox(height: 12),
            _field(_firstNameController, AppStrings.firstNameHint, Icons.person_outline,
                required: true),
            const SizedBox(height: 12),
            _field(_lastNameController, AppStrings.lastNameHint, Icons.person_outline,
                required: true),
            const SizedBox(height: 12),
            InkWell(
              onTap: _pickBirthDate,
              borderRadius: BorderRadius.circular(14),
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: AppStrings.birthDateHint,
                  prefixIcon: const Icon(Icons.cake_outlined),
                  filled: true,
                  fillColor: AppColors.darkSurface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.darkBorder),
                  ),
                ),
                child: Text(
                  _birthDate != null
                      ? DateFormat('dd.MM.yyyy').format(_birthDate!)
                      : 'Tanlang',
                  style: GoogleFonts.inter(
                    color: _birthDate != null
                        ? AppColors.darkText
                        : AppColors.darkMuted,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            _sectionTitle(AppStrings.addressSection),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _loadingLocation ? null : _fetchLocation,
              icon: _loadingLocation
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location),
              label: Text(AppStrings.getLocationAuto),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.mintGreen,
                side: BorderSide(color: AppColors.accentGreen.withValues(alpha: 0.4)),
              ),
            ),
            const SizedBox(height: 12),
            _field(_countryController, AppStrings.countryHint, Icons.flag_outlined),
            const SizedBox(height: 12),
            _field(_regionController, AppStrings.regionHint, Icons.map_outlined),
            const SizedBox(height: 12),
            _field(_districtController, AppStrings.districtHint, Icons.location_city_outlined),
            const SizedBox(height: 12),
            _field(_streetController, AppStrings.streetHint, Icons.home_outlined,
                required: true, maxLines: 2),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _sectionTitle(AppStrings.extraPhones),
                TextButton.icon(
                  onPressed: _addExtraPhone,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text("Qo'shish"),
                ),
              ],
            ),
            if (context.read<AppState>().phone != null) ...[
              InputDecorator(
                decoration: InputDecoration(
                  labelText: 'Asosiy telefon',
                  prefixIcon: const Icon(Icons.phone),
                  filled: true,
                  fillColor: AppColors.darkSurface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.darkBorder),
                  ),
                ),
                child: Text(
                  context.read<AppState>().phone!,
                  style: GoogleFonts.inter(color: AppColors.darkMuted),
                ),
              ),
              const SizedBox(height: 12),
            ],
            ..._extraPhoneControllers.asMap().entries.map((entry) {
              final index = entry.key;
              final controller = entry.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Expanded(
                      child: _field(
                        controller,
                        '${AppStrings.extraPhoneHint} ${index + 1}',
                        Icons.phone_outlined,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline, color: AppColors.error),
                      onPressed: () {
                        setState(() {
                          controller.dispose();
                          _extraPhoneControllers.removeAt(index);
                        });
                      },
                    ),
                  ],
                ),
              );
            }),
            const SizedBox(height: 16),
            GlassActionButton(
              label: AppStrings.save,
              icon: Icons.check,
              onPressed: _save,
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Text(
      title,
      style: GoogleFonts.inter(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: AppColors.darkText,
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    IconData icon, {
    bool required = false,
    bool readOnly = false,
    int maxLines = 1,
  }) {
    return TextFormField(
      controller: controller,
      readOnly: readOnly,
      maxLines: maxLines,
      style: GoogleFonts.inter(color: AppColors.darkText),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        filled: true,
        fillColor: AppColors.darkSurface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.darkBorder),
        ),
      ),
      validator: required
          ? (v) => v == null || v.trim().isEmpty ? '$label kiriting' : null
          : null,
    );
  }
}
