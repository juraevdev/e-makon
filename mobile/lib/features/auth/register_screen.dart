import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/emakon_logo.dart';
import '../../core/widgets/widgets.dart';
import 'auth_provider.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _company = TextEditingController();
  final _phone = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  String get _digits => _phone.text.replaceAll(RegExp(r'\D'), '');

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _company.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_digits.length != 9) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Telefon: 9 ta raqam kiriting'), behavior: SnackBarBehavior.floating),
      );
      return;
    }

    final auth = context.read<AuthProvider>();
    auth.setPendingRegistration(
      firstName: _first.text,
      lastName: _last.text,
      company: _company.text,
      phoneDigits: _digits,
    );

    final data = await auth.requestOtp(_digits, purpose: 'register');
    if (!mounted) return;
    final debugCode = data['debug_code']?.toString();
    context.push('/otp', extra: {
      'phone': _digits,
      if (debugCode != null) 'debug_code': debugCode,
      'from_register': true,
    });

    if (data['demo'] == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('SMS o‘rniga demo kod: $debugCode'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(
                  onPressed: () => context.canPop() ? context.pop() : context.go('/onboarding'),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
              ),
              const Center(child: EmakonLogo(size: 72)),
              const SizedBox(height: 8),
              Text(
                "Ro'yxatdan o'tish",
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: AppColors.primary),
              ),
              const SizedBox(height: 6),
              Text(
                'Ma’lumotlar profilingizga saqlanadi, SMS kod orqali tizimga kirasiz',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.onSurfaceVariant.withValues(alpha: 0.85),
                    ),
              ),
              const SizedBox(height: 28),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _first,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Ism', prefixIcon: Icon(Icons.person_outline)),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Ism kiriting' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _last,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Familiya', prefixIcon: Icon(Icons.badge_outlined)),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Familiya' : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _company,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Korxona yoki nom',
                  hintText: 'Shaxsiy yoki kompaniya nomi',
                  prefixIcon: Icon(Icons.apartment_outlined),
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(9),
                  _PhoneMaskFormatter(),
                ],
                decoration: const InputDecoration(
                  labelText: 'Telefon raqami',
                  prefixText: '+998  ',
                  hintText: '90 123 45 67',
                  prefixIcon: Icon(Icons.smartphone_rounded),
                ),
                validator: (_) => _digits.length == 9 ? null : '9 ta raqam',
              ),
              const SizedBox(height: 28),
              PrimaryButton(
                label: 'SMS kod olish',
                icon: Icons.sms_outlined,
                loading: auth.loading,
                onPressed: auth.loading ? null : _submit,
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => context.go('/login'),
                child: const Text('Hisobingiz bormi? Kirish', style: TextStyle(color: AppColors.primary)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PhoneMaskFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final limited = digits.length > 9 ? digits.substring(0, 9) : digits;
    final buf = StringBuffer();
    for (var i = 0; i < limited.length; i++) {
      if (i == 2 || i == 5 || i == 7) buf.write(' ');
      buf.write(limited[i]);
    }
    final text = buf.toString();
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}
