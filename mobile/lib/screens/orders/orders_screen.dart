import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../data/services_data.dart';
import '../../models/order.dart';
import '../../models/order_status.dart';
import '../../providers/app_state.dart';
import '../../widgets/glass_button.dart';
import 'order_detail_screen.dart';

enum _OrderFilter { all, active, completed, cancelled }

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  _OrderFilter _filter = _OrderFilter.all;

  List<GardenOrder> _filtered(List<GardenOrder> orders) {
    switch (_filter) {
      case _OrderFilter.all:
        return orders;
      case _OrderFilter.active:
        return orders.where((o) => o.status.isActive).toList();
      case _OrderFilter.completed:
        return orders.where((o) => o.status.isCompleted).toList();
      case _OrderFilter.cancelled:
        return orders.where((o) => o.status.isCancelled).toList();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: SafeArea(
        child: Consumer<AppState>(
          builder: (context, state, _) {
            if (!state.isAuthenticated) {
              return _buildEmpty(
                icon: Icons.receipt_long_outlined,
                title: AppStrings.notLoggedIn,
                subtitle: AppStrings.loginPrompt,
              );
            }

            final filtered = _filtered(state.orders);

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _OrdersHeader(avatarPath: state.profile.avatarPath),
                const SizedBox(height: 16),
                _FilterChips(
                  selected: _filter,
                  onChanged: (f) => setState(() => _filter = f),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: filtered.isEmpty
                      ? _buildEmpty(
                          icon: Icons.inbox_outlined,
                          title: AppStrings.ordersEmptyTitle,
                          subtitle: AppStrings.ordersEmptySubtitle,
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final order = filtered[index];
                            return GestureDetector(
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        OrderDetailScreen(orderId: order.id),
                                  ),
                                );
                              },
                              child: _OrderHistoryCard(order: order),
                            );
                          },
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildEmpty({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 64, color: AppColors.darkMuted),
            const SizedBox(height: 16),
            Text(
              title,
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AppColors.darkText,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: AppColors.darkMuted,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrdersHeader extends StatelessWidget {
  const _OrdersHeader({this.avatarPath});

  final String? avatarPath;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.menu_rounded, color: AppColors.accentGreen),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          ),
          Expanded(
            child: Text(
              AppStrings.navOrders,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.darkText,
              ),
            ),
          ),
          ProfileAvatar(avatarPath: avatarPath, radius: 18),
        ],
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({required this.selected, required this.onChanged});

  final _OrderFilter selected;
  final ValueChanged<_OrderFilter> onChanged;

  static const _items = [
    (_OrderFilter.all, AppStrings.ordersFilterAll),
    (_OrderFilter.active, AppStrings.ordersFilterActive),
    (_OrderFilter.completed, AppStrings.ordersFilterCompleted),
    (_OrderFilter.cancelled, AppStrings.ordersFilterCancelled),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final (filter, label) = _items[index];
          final isActive = filter == selected;
          return GestureDetector(
            onTap: () => onChanged(filter),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: isActive ? AppColors.mintGreen : AppColors.darkCard,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isActive ? AppColors.mintGreen : AppColors.darkBorder,
                ),
              ),
              child: Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isActive ? AppColors.darkBg : AppColors.darkText,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _OrderHistoryCard extends StatelessWidget {
  const _OrderHistoryCard({required this.order});

  final GardenOrder order;

  static const _months = [
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'Iyun',
    'Iyul',
    'Avgust',
    'Sentyabr',
    'Oktyabr',
    'Noyabr',
    'Dekabr',
  ];

  String get _formattedDate {
    final d = order.createdAt;
    final day = d.day.toString().padLeft(2, '0');
    return '$day ${_months[d.month - 1]}, ${d.year}';
  }

  IconData get _serviceIcon {
    final service = findServiceById(order.serviceId);
    return service?.icon ?? Icons.eco_outlined;
  }

  Color _badgeColor(OrderStatus status) {
    switch (status) {
      case OrderStatus.newOrder:
        return const Color(0xFF42A5F5);
      case OrderStatus.inReview:
      case OrderStatus.contacted:
        return const Color(0xFFFFC107);
      case OrderStatus.completed:
        return AppColors.accentGreen;
      case OrderStatus.cancelled:
        return const Color(0xFFE57373);
    }
  }

  Color _badgeBg(OrderStatus status) {
    switch (status) {
      case OrderStatus.newOrder:
        return const Color(0xFF1A3A5C);
      case OrderStatus.inReview:
      case OrderStatus.contacted:
        return const Color(0xFF3D3420);
      case OrderStatus.completed:
        return const Color(0xFF1B3D2A);
      case OrderStatus.cancelled:
        return const Color(0xFF3D1F1F);
    }
  }

  @override
  Widget build(BuildContext context) {
    final badgeColor = _badgeColor(order.status);
    final progressColor = order.status.isCancelled
        ? const Color(0xFFE57373).withValues(alpha: 0.7)
        : AppColors.accentGreen;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
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
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.darkSurface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(_serviceIcon, color: AppColors.mintGreen, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.serviceName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.darkText,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _formattedDate,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppColors.darkMuted,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: _badgeBg(order.status),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: badgeColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      order.status.label,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: badgeColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: LinearProgressIndicator(
              value: order.status.progress,
              minHeight: 3,
              backgroundColor: AppColors.darkBorder,
              valueColor: AlwaysStoppedAnimation(progressColor),
            ),
          ),
        ],
      ),
    );
  }
}
