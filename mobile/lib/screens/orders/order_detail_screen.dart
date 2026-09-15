import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../data/services_data.dart';
import '../../models/order.dart';
import '../../models/order_status.dart';
import '../../providers/app_state.dart';
import '../chat/chat_bot_screen.dart';

class OrderDetailScreen extends StatelessWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  static const _months = [
    'yanvar',
    'fevral',
    'mart',
    'aprel',
    'may',
    'iyun',
    'iyul',
    'avgust',
    'sentyabr',
    'oktyabr',
    'noyabr',
    'dekabr',
  ];

  int _completedSteps(OrderStatus status) {
    switch (status) {
      case OrderStatus.newOrder:
        return 1;
      case OrderStatus.inReview:
      case OrderStatus.contacted:
        return status == OrderStatus.contacted ? 2 : 1;
      case OrderStatus.completed:
        return 3;
      case OrderStatus.cancelled:
        return 0;
    }
  }

  Future<void> _editPhone(BuildContext context, GardenOrder order) async {
    final controller = TextEditingController(text: order.phone);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(AppStrings.orderChangePhone),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
            labelText: AppStrings.orderPhoneLabel,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Bekor qilish'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text(AppStrings.save),
          ),
        ],
      ),
    );
    if (result != null && result.isNotEmpty && context.mounted) {
      context.read<AppState>().updateOrderPhone(order.id, result);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: SafeArea(
        child: Consumer<AppState>(
          builder: (context, state, _) {
            final order = state.findOrderById(orderId);
            if (order == null) {
              return Center(
                child: Text(
                  AppStrings.orderNotFound,
                  style: GoogleFonts.inter(color: AppColors.darkMuted),
                ),
              );
            }

            final service = findServiceById(order.serviceId);
            final completedSteps = _completedSteps(order.status);

            return Column(
              children: [
                _DetailHeader(onBack: () => Navigator.pop(context)),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    children: [
                      Text(
                        AppStrings.orderStatusSection,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.accentGreen,
                          letterSpacing: 1.1,
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (order.status.isCancelled)
                        _CancelledBanner()
                      else
                        _StatusTimeline(
                          completedSteps: completedSteps,
                          acceptedAt: order.createdAt,
                          isCompleted: order.status.isCompleted,
                        ),
                      const SizedBox(height: 28),
                      Text(
                        AppStrings.orderServiceSection,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.accentGreen,
                          letterSpacing: 1.1,
                        ),
                      ),
                      const SizedBox(height: 12),
                      _ServiceInfoCard(
                        order: order,
                        serviceIcon: service?.icon ?? Icons.eco_outlined,
                        previewUrl: order.photoPath != null
                            ? null
                            : service?.heroImageUrl,
                        photoPath: order.photoPath,
                        onEditPhone: () => _editPhone(context, order),
                      ),
                      const SizedBox(height: 20),
                      _HelpButton(
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const ChatBotScreen(),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _DetailHeader extends StatelessWidget {
  const _DetailHeader({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: const Icon(
              Icons.arrow_back_rounded,
              color: AppColors.accentGreen,
            ),
          ),
          Expanded(
            child: Text(
              AppStrings.orderDetailTitle,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: AppColors.darkText,
              ),
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }
}

class _CancelledBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF3D1F1F),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE57373).withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.cancel_outlined, color: Color(0xFFE57373), size: 20),
          const SizedBox(width: 10),
          Text(
            AppStrings.orderStepCancelled,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: const Color(0xFFE57373),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusTimeline extends StatelessWidget {
  const _StatusTimeline({
    required this.completedSteps,
    required this.acceptedAt,
    required this.isCompleted,
  });

  final int completedSteps;
  final DateTime acceptedAt;
  final bool isCompleted;

  static const _months = OrderDetailScreen._months;

  String _formatDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    return '$day-${_months[date.month - 1]}, '
        '${date.hour.toString().padLeft(2, '0')}:'
        '${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final steps = [
      (
        AppStrings.orderStepAccepted,
        completedSteps > 0 ? _formatDate(acceptedAt) : AppStrings.orderStepWaiting,
      ),
      (
        AppStrings.orderStepReview,
        completedSteps > 1
            ? AppStrings.orderStepDone
            : completedSteps == 1
                ? AppStrings.orderStepCurrent
                : AppStrings.orderStepWaiting,
      ),
      (
        AppStrings.orderStepDone,
        isCompleted ? AppStrings.orderStepDone : AppStrings.orderStepWaiting,
      ),
    ];

    return Column(
      children: List.generate(steps.length, (index) {
        final isDone = index < completedSteps;
        final isCurrent = index == completedSteps && !isCompleted;
        final isLast = index == steps.length - 1;

        return _TimelineStep(
          title: steps[index].$1,
          subtitle: steps[index].$2,
          isDone: isDone,
          isCurrent: isCurrent,
          showLine: !isLast,
          lineActive: isDone,
        );
      }),
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.title,
    required this.subtitle,
    required this.isDone,
    required this.isCurrent,
    required this.showLine,
    required this.lineActive,
  });

  final String title;
  final String subtitle;
  final bool isDone;
  final bool isCurrent;
  final bool showLine;
  final bool lineActive;

  @override
  Widget build(BuildContext context) {
    final activeColor = AppColors.accentGreen;
    final inactiveColor = AppColors.darkMuted;

    Widget icon;
    if (isDone) {
      icon = Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: activeColor,
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.check, size: 16, color: AppColors.white),
      );
    } else if (isCurrent) {
      icon = Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: activeColor, width: 2),
        ),
        child: Center(
          child: Container(
            width: 10,
            height: 10,
            decoration: const BoxDecoration(
              color: AppColors.accentGreen,
              shape: BoxShape.circle,
            ),
          ),
        ),
      );
    } else {
      icon = Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: AppColors.darkCard,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.darkBorder),
        ),
        child: Icon(Icons.hourglass_empty_rounded, size: 14, color: inactiveColor),
      );
    }

    final textColor = isDone || isCurrent ? activeColor : inactiveColor;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              icon,
              if (showLine)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: lineActive ? activeColor : AppColors.darkBorder,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: showLine ? 20 : 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: textColor,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppColors.darkMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ServiceInfoCard extends StatelessWidget {
  const _ServiceInfoCard({
    required this.order,
    required this.serviceIcon,
    required this.onEditPhone,
    this.previewUrl,
    this.photoPath,
  });

  final GardenOrder order;
  final IconData serviceIcon;
  final String? previewUrl;
  final String? photoPath;
  final VoidCallback onEditPhone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.darkBorder),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.accentGreen.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(serviceIcon, color: AppColors.accentGreen, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppStrings.orderServiceType,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: AppColors.darkMuted,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      order.serviceName,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.darkText,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppStrings.orderAreaLabel,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: AppColors.darkMuted,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      order.area.isNotEmpty ? order.area : '—',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.darkText,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 72,
                  height: 56,
                  child: _buildPreview(),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.darkSurface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.phone_outlined, color: AppColors.accentGreen, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    order.phone,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AppColors.darkText,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: onEditPhone,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.accentGreen,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    AppStrings.orderChangePhone,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreview() {
    if (photoPath != null) {
      return Image.file(File(photoPath!), fit: BoxFit.cover);
    }
    if (previewUrl != null) {
      return Image.network(previewUrl!, fit: BoxFit.cover);
    }
    return Container(
      color: AppColors.darkSurface,
      child: const Icon(Icons.landscape_rounded, color: AppColors.accentGreen),
    );
  }
}

class _HelpButton extends StatelessWidget {
  const _HelpButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: const Icon(Icons.headset_mic_outlined, size: 20),
        label: Text(
          AppStrings.orderNeedHelp,
          style: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.darkText,
          side: const BorderSide(color: AppColors.darkBorder),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    );
  }
}
