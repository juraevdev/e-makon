import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../data/services_data.dart';
import '../../widgets/service_card.dart';
import '../order/order_flow_screen.dart';

class ServicesScreen extends StatelessWidget {
  const ServicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.navServices)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: GridView.builder(
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 0.82,
          ),
          itemCount: kServices.length,
          itemBuilder: (context, index) {
            final service = kServices[index];
            return ServiceCard(
              service: service,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) =>
                        OrderFlowScreen(preselectedServiceId: service.id),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class ServiceDetailSheet extends StatelessWidget {
  const ServiceDetailSheet({super.key, required this.serviceId});

  final String serviceId;

  @override
  Widget build(BuildContext context) {
    final service = findServiceById(serviceId);
    if (service == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            service.name,
            style: GoogleFonts.inter(
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            service.description,
            style: GoogleFonts.inter(
              fontSize: 15,
              color: AppColors.mutedText,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) =>
                        OrderFlowScreen(preselectedServiceId: service.id),
                  ),
                );
              },
              child: const Text(AppStrings.orderNow),
            ),
          ),
        ],
      ),
    );
  }
}
