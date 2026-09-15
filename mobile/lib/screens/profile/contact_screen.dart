import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../data/company_info.dart';

class ContactScreen extends StatelessWidget {
  const ContactScreen({super.key});

  void _copyPhone(BuildContext context, String phone) {
    Clipboard.setData(ClipboardData(text: phone));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$phone nusxa olindi')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: Text(
          AppStrings.contactUs,
          style: GoogleFonts.inter(fontWeight: FontWeight.w600),
        ),
        backgroundColor: AppColors.darkBg,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppColors.cardGradient,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  CompanyInfo.name,
                  style: GoogleFonts.inter(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.white,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  CompanyInfo.tagline,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: AppColors.white.withValues(alpha: 0.85),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  CompanyInfo.description,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: AppColors.white.withValues(alpha: 0.9),
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text(
            AppStrings.adminContacts,
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.darkText,
            ),
          ),
          const SizedBox(height: 12),
          ...CompanyInfo.admins.map((admin) => _adminCard(context, admin)),
          const SizedBox(height: 24),
          Text(
            AppStrings.companyDetails,
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.darkText,
            ),
          ),
          const SizedBox(height: 12),
          _infoTile(Icons.location_on_outlined, CompanyInfo.address),
          _infoTile(Icons.access_time, CompanyInfo.workingHours),
          _infoTile(Icons.email_outlined, CompanyInfo.email),
          _infoTile(Icons.language, CompanyInfo.website),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _adminCard(BuildContext context, AdminContact admin) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.darkBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.accentGreen.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.support_agent, color: AppColors.mintGreen),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  admin.name,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.darkText,
                  ),
                ),
                Text(
                  admin.role,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppColors.darkMuted,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  admin.phone,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AppColors.mintGreen,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => _copyPhone(context, admin.phone),
            icon: const Icon(Icons.phone, color: AppColors.accentGreen),
          ),
        ],
      ),
    );
  }

  Widget _infoTile(IconData icon, String text) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.darkSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.darkBorder),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.mintGreen, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: AppColors.darkText,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
