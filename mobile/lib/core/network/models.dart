class UserModel {
  UserModel({
    required this.id,
    required this.phone,
    required this.fullName,
    required this.role,
    this.firstName = '',
    this.lastName = '',
    this.birthDate,
    this.homeAddress = '',
    this.country = '',
    this.region = '',
    this.district = '',
    this.street = '',
    this.formattedAddress = '',
    this.locationLat,
    this.locationLng,
    this.additionalPhones = const [],
    this.avatarUrl,
  });

  final int id;
  final String phone;
  final String fullName;
  final String role;
  final String firstName;
  final String lastName;
  final DateTime? birthDate;
  final String homeAddress;
  final String country;
  final String region;
  final String district;
  final String street;
  final String formattedAddress;
  final double? locationLat;
  final double? locationLng;
  final List<String> additionalPhones;
  final String? avatarUrl;

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as int,
        phone: json['phone'] as String? ?? '',
        fullName: json['full_name'] as String? ?? '',
        role: json['role'] as String? ?? 'customer',
        firstName: json['first_name'] as String? ?? '',
        lastName: json['last_name'] as String? ?? '',
        birthDate: DateTime.tryParse(json['birth_date'] as String? ?? ''),
        homeAddress: json['home_address'] as String? ?? '',
        country: json['country'] as String? ?? '',
        region: json['region'] as String? ?? '',
        district: json['district'] as String? ?? '',
        street: json['street'] as String? ?? '',
        formattedAddress: json['formatted_address'] as String? ?? '',
        locationLat: (json['location_lat'] as num?)?.toDouble(),
        locationLng: (json['location_lng'] as num?)?.toDouble(),
        additionalPhones: (json['additional_phones'] as List?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        avatarUrl: json['avatar'] as String?,
      );
}

class ServiceModel {
  ServiceModel({
    required this.id,
    required this.name,
    required this.slug,
    required this.emoji,
    required this.icon,
    required this.shortDescription,
    required this.description,
    this.category = '',
    this.longDescription = '',
    this.heroImageUrl = '',
    this.galleryImages = const [],
    this.priceLabel = 'Kelishilgan narxda',
    this.duration = "O'rtacha vaqt: 1.5 - 2 soat",
    this.features = const [],
  });

  final int id;
  final String name;
  final String slug;
  final String emoji;
  final String icon;
  final String shortDescription;
  final String description;
  final String category;
  final String longDescription;
  final String heroImageUrl;
  final List<String> galleryImages;
  final String priceLabel;
  final String duration;
  final List<Map<String, String>> features;

  factory ServiceModel.fromJson(Map<String, dynamic> json) => ServiceModel(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
        slug: json['slug'] as String? ?? '',
        emoji: json['emoji'] as String? ?? '',
        icon: json['icon'] as String? ?? 'eco',
        shortDescription: json['short_description'] as String? ?? '',
        description: json['description'] as String? ?? '',
        category: json['category'] as String? ?? '',
        longDescription: json['long_description'] as String? ?? '',
        heroImageUrl: json['hero_image_url'] as String? ?? '',
        galleryImages: (json['gallery_images'] as List?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        priceLabel: json['price_label'] as String? ?? 'Kelishilgan narxda',
        duration: json['duration'] as String? ?? "O'rtacha vaqt: 1.5 - 2 soat",
        features: (json['features'] as List?)
                ?.whereType<Map>()
                .map((e) => {
                      'icon': '${e['icon'] ?? ''}',
                      'label': '${e['label'] ?? ''}',
                    })
                .toList() ??
            const [],
      );

  /// Fallback catalog when API offline (matches mobile kServices + seed_catalog).
  static List<ServiceModel> get fallback => [
        ServiceModel(
          id: 1,
          name: 'Bepul maslahat',
          slug: 'free-consultation',
          emoji: '📞',
          icon: 'phone_in_talk',
          category: 'Maslahat',
          shortDescription: "Bog' bo'yicha bepul maslahat va ko'rik",
          description: "Bog' bo'yicha bepul maslahat va ko'rik",
          duration: "O'rtacha vaqt: 30 daqiqa",
        ),
        ServiceModel(
          id: 2,
          name: 'Landshaft dizayn',
          slug: 'landscape-design',
          emoji: '📐',
          icon: 'architecture',
          category: 'Dizayn',
          shortDescription: "Bog'ingiz uchun professional loyiha va 3D vizualizatsiya",
          description: "Bog'ingiz uchun professional loyiha va 3D vizualizatsiya",
          duration: "O'rtacha vaqt: 2 - 3 kun",
        ),
        ServiceModel(
          id: 3,
          name: 'Daraxt parvarishi',
          slug: 'tree-care',
          emoji: '🌳',
          icon: 'park',
          category: 'Parvarish',
          shortDescription: 'Daraxtlarni kesish, shakllantirish va parvarish qilish',
          description: 'Daraxtlarni kesish, shakllantirish va parvarish qilish',
          duration: "O'rtacha vaqt: 2 - 4 soat",
        ),
        ServiceModel(
          id: 4,
          name: 'Gazon parvarish',
          slug: 'lawn-care',
          emoji: '✂️',
          icon: 'content_cut',
          category: 'Parvarish',
          shortDescription: 'Gazon kesish, parvarish va tiklash xizmatlari',
          description: 'Gazon kesish, parvarish va tiklash xizmatlari',
          duration: "O'rtacha vaqt: 1 - 2 soat",
        ),
        ServiceModel(
          id: 5,
          name: 'Archaga shakl',
          slug: 'pine-shaping',
          emoji: '🌲',
          icon: 'forest',
          category: 'Parvarish',
          shortDescription: 'Archa va ignabargli daraxtlarni shakllantirish',
          description: 'Archa va ignabargli daraxtlarni shakllantirish',
          duration: "O'rtacha vaqt: 2 - 3 soat",
        ),
        ServiceModel(
          id: 6,
          name: 'Hasharotlarga qarshi dorilash',
          slug: 'pest-control',
          emoji: '🧪',
          icon: 'science',
          category: 'Parvarish',
          shortDescription: "O'simliklarni hasharot va kasalliklardan himoya qilish",
          description: "O'simliklarni hasharot va kasalliklardan himoya qilish",
          longDescription:
              "O'simliklaringizni hasharotlar va kasalliklardan himoya qilish uchun xavfsiz va samarali usullardan foydalanamiz.",
          duration: "O'rtacha vaqt: 1.5 - 2 soat",
        ),
        ServiceModel(
          id: 7,
          name: 'Ozuqalash',
          slug: 'fertilizing',
          emoji: '🧬',
          icon: 'grain',
          category: 'Parvarish',
          shortDescription: "O'simliklarni o'g'itlash va ozuqa berish",
          description: "O'simliklarni o'g'itlash va ozuqa berish",
          duration: "O'rtacha vaqt: 1 - 2 soat",
        ),
        ServiceModel(
          id: 8,
          name: '1 yillik kafolat',
          slug: 'warranty',
          emoji: '📋',
          icon: 'verified_user',
          category: 'Kafolat',
          shortDescription: 'Barcha xizmatlar uchun 1 yillik kafolat',
          description: 'Barcha xizmatlar uchun 1 yillik kafolat',
          priceLabel: 'Bepul kafolat',
          duration: '1 yil davomida',
        ),
        ServiceModel(
          id: 9,
          name: "Sug'orish tizim",
          slug: 'irrigation',
          emoji: '💧',
          icon: 'water_drop',
          category: 'Infratuzilma',
          shortDescription: "Avtomatik sug'orish tizimini loyihalash va o'rnatish",
          description: "Avtomatik sug'orish tizimini loyihalash va o'rnatish",
          duration: "O'rtacha vaqt: 1 - 2 kun",
        ),
      ];
}

class OrderModel {
  OrderModel({
    required this.id,
    required this.status,
    required this.serviceName,
    required this.createdAt,
    this.areaSize = '',
    this.phoneNumber = '',
    this.address = '',
    this.customerFirstName = '',
    this.customerLastName = '',
    double? progress,
  }) : _apiProgress = progress;

  final int id;
  final String status;
  final String serviceName;
  final DateTime createdAt;
  final String areaSize;
  final String phoneNumber;
  final String address;
  final String customerFirstName;
  final String customerLastName;
  final double? _apiProgress;

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    final service = json['service'];
    return OrderModel(
      id: json['id'] as int,
      status: json['status'] as String? ?? 'new',
      serviceName: service is Map
          ? (service['name'] as String? ?? '')
          : (json['service_name'] as String? ?? ''),
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
      areaSize: json['area_size'] as String? ?? '',
      phoneNumber: json['phone_number'] as String? ?? '',
      address: json['address'] as String? ?? '',
      customerFirstName: json['customer_first_name'] as String? ?? '',
      customerLastName: json['customer_last_name'] as String? ?? '',
      progress: (json['progress'] as num?)?.toDouble(),
    );
  }

  String get statusLabel => switch (status) {
        'new' => 'Yangi',
        'in_review' => 'Kelishilmoqda',
        'contacted' => "Bog'lanildi",
        'completed' => 'Bajarildi',
        'cancelled' => 'Bekor qilingan',
        // legacy aliases
        'in_progress' => 'Kelishilmoqda',
        'accepted' => "Bog'lanildi",
        'done' => 'Bajarildi',
        _ => status,
      };

  double get progress =>
      _apiProgress ??
      switch (status) {
        'new' => 0.22,
        'in_review' || 'in_progress' => 0.48,
        'contacted' || 'accepted' => 0.72,
        'completed' || 'done' || 'cancelled' => 1.0,
        _ => 0.1,
      };
}
