import 'package:flutter/material.dart';

class ServiceFeature {
  const ServiceFeature({required this.icon, required this.label});

  final IconData icon;
  final String label;
}

class GardenService {
  const GardenService({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    required this.category,
    this.longDescription,
    this.heroImageUrl,
    this.galleryImages = const [],
    this.priceLabel = 'Kelishilgan narxda',
    this.duration = "O'rtacha vaqt: 1.5 - 2 soat",
    this.features = const [],
  });

  final String id;
  final String name;
  final String description;
  final IconData icon;
  final String category;
  final String? longDescription;
  final String? heroImageUrl;
  final List<String> galleryImages;
  final String priceLabel;
  final String duration;
  final List<ServiceFeature> features;

  String get detailDescription => longDescription ?? description;
}
