import 'package:flutter/material.dart';

import '../models/service.dart';

const _sprayHero =
    'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800';
const _sprayGallery1 =
    'https://images.unsplash.com/photo-1592419044706-39796d40f98c?w=600';
const _sprayGallery2 =
    'https://images.unsplash.com/photo-1585320806297-9794b1703bda?w=600';
const _sprayGallery3 =
    'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600';

const _defaultFeatures = [
  ServiceFeature(icon: Icons.verified_outlined, label: 'Kafolat'),
  ServiceFeature(icon: Icons.eco_outlined, label: 'Sifatli dori'),
  ServiceFeature(icon: Icons.groups_outlined, label: 'Ekspertlar'),
  ServiceFeature(icon: Icons.schedule_outlined, label: 'Tezkorlik'),
];

const List<GardenService> kServices = [
  GardenService(
    id: 'free_consultation',
    name: 'Bepul maslahat',
    description: "Bog' bo'yicha bepul maslahat va ko'rik",
    icon: Icons.phone_in_talk_outlined,
    category: 'Maslahat',
    duration: "O'rtacha vaqt: 30 daqiqa",
  ),
  GardenService(
    id: 'landscape_design',
    name: 'Landshaft dizayn',
    description: "Bog'ingiz uchun professional loyiha va 3D vizualizatsiya",
    icon: Icons.architecture_outlined,
    category: 'Dizayn',
    duration: "O'rtacha vaqt: 2 - 3 kun",
  ),
  GardenService(
    id: 'tree_care',
    name: 'Daraxt parvarishi',
    description: 'Daraxtlarni kesish, shakllantirish va parvarish qilish',
    icon: Icons.park_outlined,
    category: 'Parvarish',
    duration: "O'rtacha vaqt: 2 - 4 soat",
  ),
  GardenService(
    id: 'lawn_care',
    name: 'Gazon parvarish',
    description: 'Gazon kesish, parvarish va tiklash xizmatlari',
    icon: Icons.content_cut_outlined,
    category: 'Parvarish',
    duration: "O'rtacha vaqt: 1 - 2 soat",
  ),
  GardenService(
    id: 'pine_shaping',
    name: 'Archaga shakl',
    description: 'Archa va ignabargli daraxtlarni shakllantirish',
    icon: Icons.forest_outlined,
    category: 'Parvarish',
    duration: "O'rtacha vaqt: 2 - 3 soat",
  ),
  GardenService(
    id: 'pest_control',
    name: 'Hasharotlarga qarshi dorilash',
    description: "O'simliklarni hasharot va kasalliklardan himoya qilish",
    longDescription:
        "O'simliklaringizni hasharotlar va kasalliklardan himoya qilish uchun xavfsiz va samarali usullardan foydalanamiz. Faqat sertifikatlangan preparatlar qo'llaniladi.",
    icon: Icons.science_outlined,
    category: 'Parvarish',
    heroImageUrl: _sprayHero,
    galleryImages: [_sprayGallery1, _sprayGallery2, _sprayGallery3],
    duration: "O'rtacha vaqt: 1.5 - 2 soat",
    features: _defaultFeatures,
  ),
  GardenService(
    id: 'fertilizing',
    name: 'Ozuqalash',
    description: "O'simliklarni o'g'itlash va ozuqa berish",
    icon: Icons.grain_outlined,
    category: 'Parvarish',
    duration: "O'rtacha vaqt: 1 - 2 soat",
  ),
  GardenService(
    id: 'warranty',
    name: '1 yillik kafolat',
    description: 'Barcha xizmatlar uchun 1 yillik kafolat',
    icon: Icons.verified_outlined,
    category: 'Kafolat',
    priceLabel: 'Bepul kafolat',
    duration: '1 yil davomida',
  ),
  GardenService(
    id: 'irrigation',
    name: "Sug'orish tizim",
    description: "Avtomatik sug'orish tizimini loyihalash va o'rnatish",
    icon: Icons.water_drop_outlined,
    category: 'Infratuzilma',
    duration: "O'rtacha vaqt: 1 - 2 kun",
  ),
];

GardenService? findServiceById(String id) {
  try {
    return kServices.firstWhere((s) => s.id == id);
  } catch (_) {
    return null;
  }
}
