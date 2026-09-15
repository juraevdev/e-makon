import 'dart:async';

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

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_seconds <= 0) {
        _timer?.cancel();
        setState(() {});
        return;
      }
      setState(() => _seconds--);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.debugCode != null && widget.debugCode!.length == 6) {
        for (var i = 0; i < 6; i++) {
          _controllers[i].text = widget.debugCode![i];
        }
      }
      _focus[0].requestFocus();
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

  Future<void> _verify([String? code]) async {
    final submit = code ?? _code;
    if (submit.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('6 xonali kodni kiriting')),
      );
      return;
    }
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
        SnackBar(content: Text(context.read<AuthProvider>().error ?? 'OTP xato')),
      );
    }
  }

  Future<void> _resend() async {
    try {
      final data = await context.read<AuthProvider>().requestOtp(widget.phoneDigits);
      final debug = data['debug_code']?.toString();
      if (debug != null && debug.length == 6) {
        for (var i = 0; i < 6; i++) {
          _controllers[i].text = debug[i];
        }
      }
      setState(() => _seconds = 59);
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
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Tasdiqlash kodi', style: Theme.of(context).textTheme.headlineLarge),
              const SizedBox(height: 8),
              Text(
                '$_prettyPhone raqamiga yuborilgan kodni kiriting',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.onSurfaceVariant.withValues(alpha: 0.8),
                    ),
              ),
              if (widget.debugCode != null) ...[
                const SizedBox(height: 8),
                Text('Dev OTP: ${widget.debugCode}', style: const TextStyle(color: AppColors.primary)),
              ],
              const SizedBox(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(6, (i) {
                  return SizedBox(
                    width: 48,
                    height: 64,
                    child: TextField(
                      controller: _controllers[i],
                      focusNode: _focus[i],
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: AppColors.primary),
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(1),
                      ],
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: AppColors.glass,
                        contentPadding: EdgeInsets.zero,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: AppColors.outlineVariant.withValues(alpha: 0.3)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.primary),
                        ),
                      ),
                      onChanged: (v) {
                        if (v.isNotEmpty && i < 5) _focus[i + 1].requestFocus();
                        if (v.isEmpty && i > 0) _focus[i - 1].requestFocus();
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
                        'Qayta yuborish (00:${_seconds.toString().padLeft(2, '0')})',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: AppColors.onSurfaceVariant.withValues(alpha: 0.6),
                            ),
                      )
                    : TextButton(
                        onPressed: _resend,
                        child: const Text('Kodni qayta yuborish', style: TextStyle(color: AppColors.primary)),
                      ),
              ),
              const Spacer(),
              PrimaryButton(
                label: 'TASDIQLASH',
                loading: auth.loading,
                onPressed: _verify,
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
