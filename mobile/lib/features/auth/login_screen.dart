import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/constants/api_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/emakon_logo.dart';
import '../../core/widgets/motion.dart';
import '../../core/widgets/widgets.dart';
import 'auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  String? _localError;
  late final AnimationController _intro;

  String get _digits => _controller.text.replaceAll(RegExp(r'\D'), '');

  bool get _isValid => _digits.length == 9;

  @override
  void initState() {
    super.initState();
    _intro = AnimationController(vsync: this, duration: const Duration(milliseconds: 800))..forward();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  @override
  void dispose() {
    _intro.dispose();
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    if (!_isValid) {
      setState(() => _localError = '9 ta raqam kiriting (masalan: 90 123 45 67)');
      return;
    }
    setState(() => _localError = null);
    FocusScope.of(context).unfocus();

    final auth = context.read<AuthProvider>();
    try {
      final data = await auth.requestOtp(_digits);
      if (!mounted) return;

      final debugCode = data['debug_code']?.toString();
      final isDemo = data['demo'] == true;

      context.push('/otp', extra: {
        'phone': _digits,
        if (debugCode != null && debugCode.isNotEmpty) 'debug_code': debugCode,
      });

      if (isDemo && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Server topilmadi. Vaqtinchalik kod: $debugCode'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      context.push('/otp', extra: {
        'phone': _digits,
        'debug_code': AuthProvider.demoOtpCode,
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.error ?? 'SMS yuborilmadi. Dev kod: ${AuthProvider.demoOtpCode}'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final loading = context.select<AuthProvider, bool>((a) => a.loading);
    return Scaffold(
      body: AmbientBackdrop(
        child: SafeArea(
          child: FadeSlideIn(
            animation: _intro,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                children: [
                  const Spacer(flex: 2),
                  const EmakonLogo(size: 108, animate: true),
                  const SizedBox(height: 8),
                  Text(
                    'Xush kelibsiz',
                    style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                          color: AppColors.primary,
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Telefon raqamingizni kiriting — SMS orqali kod yuboramiz',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.onSurfaceVariant.withValues(alpha: 0.9),
                        ),
                  ),
                  const SizedBox(height: 28),
                  GlassCard(
                    borderRadius: 20,
                    padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Telefon raqami',
                          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                color: AppColors.onSurfaceVariant,
                              ),
                        ),
                        const SizedBox(height: 10),
                        ValueListenableBuilder<TextEditingValue>(
                          valueListenable: _controller,
                          builder: (context, value, _) {
                            final digits = value.text.replaceAll(RegExp(r'\D'), '');
                            final valid = digits.length == 9;
                            return TextField(
                              controller: _controller,
                              focusNode: _focus,
                              keyboardType: TextInputType.phone,
                              textInputAction: TextInputAction.done,
                              autofillHints: const [AutofillHints.telephoneNumberNational],
                              onSubmitted: (_) => _continue(),
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(9),
                                _PhoneMaskFormatter(),
                              ],
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.6,
                              ),
                              decoration: InputDecoration(
                                prefixIcon: const Padding(
                                  padding: EdgeInsets.only(left: 12, right: 4),
                                  child: Icon(Icons.smartphone_rounded, color: AppColors.primary),
                                ),
                                prefixIconConstraints: const BoxConstraints(minWidth: 44, minHeight: 24),
                                prefixText: '+998  ',
                                prefixStyle: const TextStyle(
                                  color: AppColors.onSurface,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 18,
                                ),
                                hintText: '90 123 45 67',
                                hintStyle: TextStyle(
                                  color: AppColors.onSurfaceVariant.withValues(alpha: 0.45),
                                  fontWeight: FontWeight.w500,
                                  fontSize: 18,
                                ),
                                counterText: '',
                                suffixIcon: digits.isEmpty
                                    ? null
                                    : IconButton(
                                        tooltip: 'Tozalash',
                                        onPressed: () {
                                          _controller.clear();
                                          _focus.requestFocus();
                                        },
                                        icon: const Icon(Icons.close_rounded, size: 20),
                                      ),
                                helperText: valid ? 'SMS kod shu raqamga yuboriladi' : 'O‘zbekiston raqami: 9 ta raqam',
                                helperStyle: TextStyle(
                                  color: valid ? AppColors.primary : AppColors.onSurfaceVariant.withValues(alpha: 0.7),
                                ),
                                errorText: _localError,
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 16),
                        ValueListenableBuilder<TextEditingValue>(
                          valueListenable: _controller,
                          builder: (context, value, _) {
                            final valid = value.text.replaceAll(RegExp(r'\D'), '').length == 9;
                            return PrimaryButton(
                              label: 'SMS kod olish',
                              icon: Icons.sms_outlined,
                              loading: loading,
                              onPressed: valid && !loading ? _continue : null,
                              filled: false,
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => context.push('/register'),
                    child: const Text(
                      "Hisobingiz yo‘qmi? Ro‘yxatdan o‘ting",
                      style: TextStyle(color: AppColors.primary),
                    ),
                  ),
                  const Spacer(flex: 2),
                  Text(
                    '${ApiConfig.brandName} · Foydalanish shartlari',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.outlineVariant,
                        ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
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
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
