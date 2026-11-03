import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/settings/app_settings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/season_theme.dart';
import '../../core/widgets/motion.dart';
import 'plant_health_demo.dart';

enum _Phase { idle, analyzing, result }

class PlantScannerScreen extends StatefulWidget {
  const PlantScannerScreen({super.key});

  @override
  State<PlantScannerScreen> createState() => _PlantScannerScreenState();
}

class _PlantScannerScreenState extends State<PlantScannerScreen> {
  final _picker = ImagePicker();
  _Phase _phase = _Phase.idle;
  Uint8List? _bytes;
  String? _error;
  PlantScanResult? _result;

  Future<void> _pick(ImageSource source) async {
    setState(() => _error = null);
    try {
      final file = await _picker.pickImage(
        source: source,
        maxWidth: 1600,
        imageQuality: 85,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        _bytes = bytes;
        _phase = _Phase.analyzing;
        _result = null;
      });
      await Future<void>.delayed(const Duration(milliseconds: 1600));
      if (!mounted) return;
      final lang = context.read<AppSettings>().language;
      final seed = bytes.isEmpty ? Random().nextInt(999) : bytes.length + bytes.first + bytes.last;
      setState(() {
        _result = PlantHealthDemo.analyze(seed: seed, lang: lang);
        _phase = _Phase.result;
      });
    } catch (_) {
      if (!mounted) return;
      final t = context.l10nRead;
      setState(() {
        _error = t.plantScanFailed;
        _phase = _Phase.idle;
      });
    }
  }

  void _reset() {
    setState(() {
      _phase = _Phase.idle;
      _bytes = null;
      _result = null;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.l10n;
    final season = SeasonTheme.of();
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: AmbientBackdrop(
        intensity: 0.95,
        season: season,
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 12, 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t.plantScanner,
                            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 26,
                                  color: scheme.onSurface,
                                ),
                          ),
                          Text(
                            t.plantScannerSubtitle,
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    if (_phase == _Phase.result)
                      TextButton(
                        onPressed: _reset,
                        child: Text(t.scanAgain, style: TextStyle(color: season.accent, fontWeight: FontWeight.w700)),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: switch (_phase) {
                  _Phase.idle => _IdleView(
                      error: _error,
                      onCamera: () => _pick(ImageSource.camera),
                      onGallery: () => _pick(ImageSource.gallery),
                    ),
                  _Phase.analyzing => _AnalyzingView(bytes: _bytes),
                  _Phase.result => _ResultView(bytes: _bytes, result: _result!),
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IdleView extends StatelessWidget {
  const _IdleView({required this.onCamera, required this.onGallery, this.error});

  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final t = context.l10n;
    final season = SeasonTheme.of();
    final scheme = Theme.of(context).colorScheme;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                season.accent.withValues(alpha: 0.22),
                AppColors.surfaceContainerHigh.withValues(alpha: AppColors.isLight ? 0.95 : 0.55),
              ],
            ),
            border: Border.all(color: season.accent.withValues(alpha: 0.35)),
          ),
          child: Column(
            children: [
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: season.accent.withValues(alpha: 0.18),
                  border: Border.all(color: season.accent.withValues(alpha: 0.45), width: 2),
                ),
                child: Icon(Icons.document_scanner_outlined, size: 40, color: season.accent),
              ),
              const SizedBox(height: 16),
              Text(
                t.plantScanHero,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: scheme.onSurface,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                t.plantScanHeroBody,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        FilledButton.icon(
          onPressed: onCamera,
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.onPrimary,
          ),
          icon: const Icon(Icons.photo_camera_outlined),
          label: Text(t.scanWithCamera, style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: onGallery,
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          icon: const Icon(Icons.photo_library_outlined),
          label: Text(t.pickFromGallery, style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
        if (error != null) ...[
          const SizedBox(height: 12),
          Text(error!, style: TextStyle(color: scheme.error, fontWeight: FontWeight.w600)),
        ],
        const SizedBox(height: 22),
        Text(t.whatWeDetect, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        _HintTile(icon: Icons.coronavirus_outlined, title: t.diseases, body: t.diseasesHint, color: const Color(0xFFE57373)),
        _HintTile(icon: Icons.bug_report_outlined, title: t.harmfulAgents, body: t.harmfulAgentsHint, color: const Color(0xFFFFB74D)),
        _HintTile(icon: Icons.science_outlined, title: t.deficiencies, body: t.deficienciesHint, color: const Color(0xFF81C784)),
        if (kIsWeb) ...[
          const SizedBox(height: 8),
          Text(
            t.plantScanWebNote,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
      ],
    );
  }
}

class _HintTile extends StatelessWidget {
  const _HintTile({required this.icon, required this.title, required this.body, required this.color});

  final IconData icon;
  final String title;
  final String body;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: AppColors.surfaceContainerHigh.withValues(alpha: AppColors.isLight ? 0.9 : 0.5),
          border: Border.all(color: color.withValues(alpha: 0.28)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontWeight: FontWeight.w800, color: scheme.onSurface)),
                  const SizedBox(height: 2),
                  Text(body, style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant, height: 1.35)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnalyzingView extends StatelessWidget {
  const _AnalyzingView({this.bytes});

  final Uint8List? bytes;

  @override
  Widget build(BuildContext context) {
    final t = context.l10n;
    final season = SeasonTheme.of();
    final scheme = Theme.of(context).colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (bytes != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Image.memory(bytes!, height: 180, width: 180, fit: BoxFit.cover),
              ),
            const SizedBox(height: 24),
            SizedBox(
              width: 42,
              height: 42,
              child: CircularProgressIndicator(color: season.accent, strokeWidth: 3),
            ),
            const SizedBox(height: 16),
            Text(
              t.analyzingPlant,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: scheme.onSurface),
            ),
            const SizedBox(height: 6),
            Text(
              t.analyzingPlantHint,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultView extends StatelessWidget {
  const _ResultView({required this.result, this.bytes});

  final Uint8List? bytes;
  final PlantScanResult result;

  Color _sevColor(String s) => switch (s) {
        'high' => const Color(0xFFE57373),
        'medium' => const Color(0xFFFFB74D),
        _ => const Color(0xFF81C784),
      };

  String _sevLabel(AppStrings t, String s) => switch (s) {
        'high' => t.severityHigh,
        'medium' => t.severityMedium,
        _ => t.severityLow,
      };

  @override
  Widget build(BuildContext context) {
    final t = context.l10n;
    final season = SeasonTheme.of();
    final scheme = Theme.of(context).colorScheme;
    final scoreColor = result.healthScore >= 70
        ? const Color(0xFF81C784)
        : result.healthScore >= 50
            ? const Color(0xFFFFB74D)
            : const Color(0xFFE57373);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (bytes != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.memory(bytes!, width: 92, height: 92, fit: BoxFit.cover),
              )
            else
              Container(
                width: 92,
                height: 92,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: season.accent.withValues(alpha: 0.2),
                ),
                child: Text(result.emoji, style: const TextStyle(fontSize: 40)),
              ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${result.emoji} ${result.plantName}',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: scheme.onSurface)),
                  const SizedBox(height: 6),
                  Text(result.summary, style: TextStyle(color: scheme.onSurfaceVariant, height: 1.35)),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: scoreColor.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(99),
                      border: Border.all(color: scoreColor.withValues(alpha: 0.45)),
                    ),
                    child: Text(
                      '${t.healthScore}: ${result.healthScore}/100',
                      style: TextStyle(color: scoreColor, fontWeight: FontWeight.w800, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        _Section(
          title: t.diseases,
          icon: Icons.coronavirus_outlined,
          color: const Color(0xFFE57373),
          empty: t.noDiseasesFound,
          children: [
            for (final i in result.diseases)
              _IssueCard(
                issue: i,
                severityLabel: _sevLabel(t, i.severity),
                severityColor: _sevColor(i.severity),
              ),
          ],
        ),
        _Section(
          title: t.harmfulAgents,
          icon: Icons.bug_report_outlined,
          color: const Color(0xFFFFB74D),
          empty: t.noHarmfulFound,
          children: [
            for (final i in result.toxins)
              _IssueCard(
                issue: i,
                severityLabel: _sevLabel(t, i.severity),
                severityColor: _sevColor(i.severity),
              ),
          ],
        ),
        _Section(
          title: t.deficiencies,
          icon: Icons.science_outlined,
          color: const Color(0xFF81C784),
          empty: t.noDeficienciesFound,
          children: [
            for (final i in result.deficiencies)
              _IssueCard(
                issue: i,
                severityLabel: _sevLabel(t, i.severity),
                severityColor: _sevColor(i.severity),
              ),
          ],
        ),
        Text(t.careTips, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        for (final tip in result.tips)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.check_circle, size: 18, color: season.accent),
                const SizedBox(width: 8),
                Expanded(child: Text(tip, style: TextStyle(color: scheme.onSurface, height: 1.35))),
              ],
            ),
          ),
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: () => context.push('/service/${result.relatedServiceSlug}'),
          icon: const Icon(Icons.handyman_outlined),
          label: Text(t.getHelpService),
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.onPrimary,
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => context.go('/shop'),
          icon: const Icon(Icons.storefront_outlined),
          label: Text(t.shopRemedies),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46)),
        ),
        const SizedBox(height: 10),
        Text(
          t.plantScanDisclaimer,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant, height: 1.35),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.icon,
    required this.color,
    required this.children,
    required this.empty,
  });

  final String title;
  final IconData icon;
  final Color color;
  final List<Widget> children;
  final String empty;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: 8),
              Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 10),
          if (children.isEmpty)
            Text(empty, style: TextStyle(color: scheme.onSurfaceVariant))
          else
            ...children,
        ],
      ),
    );
  }
}

class _IssueCard extends StatelessWidget {
  const _IssueCard({
    required this.issue,
    required this.severityLabel,
    required this.severityColor,
  });

  final PlantIssue issue;
  final String severityLabel;
  final Color severityColor;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final t = context.l10n;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: AppColors.surfaceContainerHigh.withValues(alpha: AppColors.isLight ? 0.95 : 0.55),
        border: Border.all(color: severityColor.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(issue.title, style: TextStyle(fontWeight: FontWeight.w800, color: scheme.onSurface, fontSize: 15)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: severityColor.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(severityLabel, style: TextStyle(color: severityColor, fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(issue.detail, style: TextStyle(color: scheme.onSurfaceVariant, height: 1.35)),
          const SizedBox(height: 8),
          Text('${t.advice}: ${issue.advice}', style: TextStyle(color: scheme.onSurface, fontWeight: FontWeight.w600, height: 1.35)),
        ],
      ),
    );
  }
}
