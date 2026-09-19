import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/widgets.dart';
import 'auth_provider.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key, required this.phoneDigits, this.debugCode});

  final String phoneDigits;
  final String? debugCode;

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _controllers = List.generate(6, (_) => TextEditingController());
  final _focus = List.generate(6, (_) => FocusNode());
  int _seconds = 59;
  Timer? _timer;
  bool _submitting = false;
  String? _debugCode;

  @override
  void initState() {
    super.initState();
    _debugCode = widget.debugCode;
    _startTimer();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (kDebugMode && _debugCode != null && _debugCode!.length == 6) {
        _fillCode(_debugCode!);
      }
      _focus[0].requestFocus();
    });
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_seconds <= 0) {
        _timer?.cancel();
        setState(() {});
        return;
      }
      setState(() => _seconds--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focus) {
      f.dispose();
    }
    super.dispose();
  }

  String get _code => _controllers.map((c) => c.text).join();

  String get _prettyPhone {
    final d = widget.phoneDigits;
    if (d.length != 9) return '+998 ${widget.phoneDigits}';
    return '+998 ${d.substring(0, 2)} ${d.substring(2, 5)} ${d.substring(5, 7)} ${d.substring(7)}';
  }

  void _fillCode(String code) {
    final digits = code.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return;
    for (var i = 0; i < 6; i++) {
      _controllers[i].text = i < digits.length ? digits[i] : '';
    }
    final next = digits.length.clamp(0, 5);
    _focus[next].requestFocus();
    if (digits.length >= 6) {
      _verify(digits.substring(0, 6));
    }
  }

  void _onBoxChanged(int i, String value) {
    // Paste of full SMS code into one box
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 1) {
      _fillCode(digits);
      return;
    }

    if (digits.isEmpty) {
      if (i > 0) _focus[i - 1].requestFocus();
      setState(() {});
      return;
    }

    if (_controllers[i].text != digits) {
      _controllers[i].text = digits;
    }
    if (i < 5) {
      _focus[i + 1].requestFocus();
    }
    if (_code.length == 6) {
      _verify(_code);
    }
    setState(() {});
  }

  Future<void> _verify([String? code]) async {
    final submit = code ?? _code;
    if (submit.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('6 xonali SMS kodni kiriting'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (_submitting) return;
    setState(() => _submitting = true);
    FocusScope.of(context).unfocus();
    try {
      await context.read<AuthProvider>().verifyOtp(
            phoneDigits: widget.phoneDigits,
            code: submit,
          );
      if (!mounted) return;
      context.go('/home');
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.read<AuthProvider>().error ?? 'Kod noto‘g‘ri yoki muddati o‘tgan'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      for (final c in _controllers) {
        c.clear();
      }
      _focus[0].requestFocus();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _resend() async {
    try {
      final data = await context.read<AuthProvider>().requestOtp(widget.phoneDigits);
      final debug = data['debug_code']?.toString();
      if (kDebugMode && debug != null && debug.length == 6) {
        _debugCode = debug;
        _fillCode(debug);
      } else {
        for (final c in _controllers) {
          c.clear();
        }
        _focus[0].requestFocus();
      }
      setState(() => _seconds = 59);
      _startTimer();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Yangi SMS kod yuborildi'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.read<AuthProvider>().error ?? 'Qayta yuborib bo‘lmadi'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final loading = auth.loading || _submitting;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
        title: const Text('SMS tasdiqlash'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 8),
              Text(
                'Tasdiqlash kodi',
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: 8),
              Text.rich(
                TextSpan(
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.onSurfaceVariant.withValues(alpha: 0.85),
                      ),
                  children: [
                    const TextSpan(text: 'SMS orqali '),
                    TextSpan(
                      text: _prettyPhone,
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const TextSpan(text: ' raqamiga yuborilgan 6 xonali kodni kiriting'),
                  ],
                ),
              ),
              if (kDebugMode && _debugCode != null) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primaryContainer.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    'Dev OTP: $_debugCode',
                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
              const SizedBox(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(6, (i) {
                  final filled = _controllers[i].text.isNotEmpty;
                  return SizedBox(
                    width: 48,
                    height: 64,
                    child: TextField(
                      controller: _controllers[i],
                      focusNode: _focus[i],
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      textInputAction: i == 5 ? TextInputAction.done : TextInputAction.next,
                      autofillHints: i == 0 ? const [AutofillHints.oneTimeCode] : null,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(6),
                      ],
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: AppColors.glass,
                        contentPadding: EdgeInsets.zero,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: filled
                                ? AppColors.primary.withValues(alpha: 0.5)
                                : AppColors.outlineVariant.withValues(alpha: 0.3),
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: filled
                                ? AppColors.primary.withValues(alpha: 0.55)
                                : AppColors.outlineVariant.withValues(alpha: 0.3),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.primary, width: 1.6),
                        ),
                      ),
                      onChanged: (v) => _onBoxChanged(i, v),
                      onSubmitted: (_) {
                        if (_code.length == 6) _verify(_code);
                      },
                    ),
                  );
                }),
              ),
              const SizedBox(height: 24),
              Center(
                child: _seconds > 0
                    ? Text(
                        'Qayta yuborish · 00:${_seconds.toString().padLeft(2, '0')}',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: AppColors.onSurfaceVariant.withValues(alpha: 0.65),
                            ),
                      )
                    : TextButton(
                        onPressed: loading ? null : _resend,
                        child: const Text(
                          'Kodni qayta yuborish',
                          style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
                        ),
                      ),
              ),
              const Spacer(),
              PrimaryButton(
                label: 'Tasdiqlash',
                loading: loading,
                onPressed: _code.length == 6 && !loading ? () => _verify() : null,
                roundedFull: true,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
