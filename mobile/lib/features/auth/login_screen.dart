import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/constants/api_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';
import 'auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _controller = TextEditingController();
  String? _localError;

  String get _digits => _controller.text.replaceAll(RegExp(r'\D'), '');

  Future<void> _continue() async {
    if (_digits.length != 9) {
      setState(() => _localError = '9 ta raqam kiriting');
      return;
    }
    setState(() => _localError = null);
    try {
      final data = await context.read<AuthProvider>().requestOtp(_digits);
      if (!mounted) return;
      final debugCode = data['debug_code']?.toString();
      context.push('/otp', extra: {
        'phone': _digits,
        if (debugCode != null) 'debug_code': debugCode,
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<AuthProvider>().error ?? 'Xatolik')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              const Spacer(flex: 2),
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primaryContainer.withValues(alpha: 0.3),
                ),
                child: const Icon(Icons.eco, size: 64, color: AppColors.primary),
              ),
              const SizedBox(height: 20),
              Text(ApiConfig.brandName, style: Theme.of(context).textTheme.headlineLarge),
              const Spacer(),
              Text(
                'Xush kelibsiz',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: AppColors.primary),
              ),
              const SizedBox(height: 8),
              Text(
                "Bog'dorchilik olamiga xush kelibsiz",
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.onSurfaceVariant.withValues(alpha: 0.8),
                    ),
              ),
              const SizedBox(height: 32),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Telefon raqami',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AppColors.onSurfaceVariant,
                      ),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _controller,
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(9),
                  _PhoneMaskFormatter(),
                ],
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.smartphone, color: AppColors.primary),
                  prefixText: '+998  ',
                  prefixStyle: TextStyle(
                    color: AppColors.onSurface,
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                  ),
                  hintText: '90 123 45 67',
                ),
              ),
              if (_localError != null) ...[
                const SizedBox(height: 8),
                Text(_localError!, style: const TextStyle(color: AppColors.error)),
              ],
              const SizedBox(height: 24),
              PrimaryButton(
                label: 'Davom etish',
                icon: Icons.arrow_forward,
                loading: auth.loading,
                onPressed: _continue,
                filled: false,
              ),
              const Spacer(flex: 2),
              Text(
                'Foydalanish shartlari va Maxfiylik siyosati',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      decoration: TextDecoration.underline,
                      color: AppColors.outlineVariant,
                    ),
              ),
              const SizedBox(height: 24),
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
    final buf = StringBuffer();
    for (var i = 0; i < digits.length && i < 9; i++) {
      if (i == 2 || i == 5 || i == 7) buf.write(' ');
      buf.write(digits[i]);
    }
    final text = buf.toString();
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}
