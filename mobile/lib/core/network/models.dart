/// Domain models for e-makon.

class UserModel {
  UserModel({
    required this.id,
    required this.phone,
    required this.fullName,
    required this.role,
    this.firstName = '',
    this.lastName = '',
    this.company = '',
    this.email = '',
    this.address = '',
    this.avatarPath,
    this.points = 0,
    this.rating = 5.0,
    this.ratingCount = 0,
  });

  final int id;
  final String phone;
  final String fullName;
  final String role;
  final String firstName;
  final String lastName;
  final String company;
  final String email;
  final String address;
  final String? avatarPath;
  final int points;
  final double rating;
  final int ratingCount;

  String get displayName {
    final n = '$firstName $lastName'.trim();
    if (n.isNotEmpty) return n;
    if (fullName.isNotEmpty) return fullName;
    if (company.isNotEmpty) return company;
    return 'Foydalanuvchi';
  }

  UserModel copyWith({
    int? id,
    String? phone,
    String? fullName,
    String? role,
    String? firstName,
    String? lastName,
    String? company,
    String? email,
    String? address,
    String? avatarPath,
    int? points,
    double? rating,
    int? ratingCount,
    bool clearAvatar = false,
  }) {
    return UserModel(
      id: id ?? this.id,
      phone: phone ?? this.phone,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      company: company ?? this.company,
      email: email ?? this.email,
      address: address ?? this.address,
      avatarPath: clearAvatar ? null : (avatarPath ?? this.avatarPath),
      points: points ?? this.points,
      rating: rating ?? this.rating,
      ratingCount: ratingCount ?? this.ratingCount,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'phone': phone,
        'full_name': fullName,
        'role': role,
        'first_name': firstName,
        'last_name': lastName,
        'company': company,
        'email': email,
        'address': address,
        'avatar_path': avatarPath,
        'points': points,
        'rating': rating,
        'rating_count': ratingCount,
      };

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as int? ?? 0,
        phone: json['phone'] as String? ?? '',
        fullName: json['full_name'] as String? ?? '',
        role: json['role'] as String? ?? 'customer',
        firstName: json['first_name'] as String? ?? '',
        lastName: json['last_name'] as String? ?? '',
        company: json['company'] as String? ?? '',
        email: json['email'] as String? ?? '',
        address: json['address'] as String? ?? '',
        avatarPath: json['avatar_path'] as String?,
        points: json['points'] as int? ?? 0,
        rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
        ratingCount: json['rating_count'] as int? ?? 0,
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
    this.accent = 0xFF88D982,
    this.priceMin = 0,
    this.priceMax = 0,
    this.image = '',
  });

  final int id;
  final String name;
  final String slug;
  final String emoji;
  final String icon;
  final String shortDescription;
  final String description;
  final int accent;
  final int priceMin;
  final int priceMax;
  final String image;

  bool get hasImage => image.isNotEmpty;

  static String formatMoney(int n) {
    final s = n.toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
      buf.write(s[i]);
    }
    return buf.toString();
  }

  String get priceLabel {
    if (priceMin <= 0 && priceMax <= 0) return 'Bepul';
    if (priceMax <= 0 || priceMin == priceMax) return '${formatMoney(priceMin)} so‘m';
    return '${formatMoney(priceMin)} – ${formatMoney(priceMax)} so‘m';
  }

  factory ServiceModel.fromJson(Map<String, dynamic> json) => ServiceModel(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
        slug: json['slug'] as String? ?? '',
        emoji: json['emoji'] as String? ?? '',
        icon: json['icon'] as String? ?? 'eco',
        shortDescription: json['short_description'] as String? ?? '',
        description: json['description'] as String? ?? '',
        accent: json['accent'] as int? ?? 0xFF88D982,
        priceMin: json['price_min'] as int? ?? json['price'] as int? ?? 0,
        priceMax: json['price_max'] as int? ?? json['price'] as int? ?? 0,
        image: json['image'] as String? ?? json['image_url'] as String? ?? '',
      );

  static List<ServiceModel> get fallback => const [];
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
    this.notes = '',
    this.partnerName = '',
    this.distanceKm = 0,
    this.amount = 0,
    this.pointsEarned = 0,
    this.serviceNames = const [],
    this.receiptCode = '',
    this.scheduledDate,
    this.timeSlot = '',
    this.lat,
    this.lng,
    this.partnerLat,
    this.partnerLng,
  });

  final int id;
  final String status;
  final String serviceName;
  final DateTime createdAt;
  final String areaSize;
  final String phoneNumber;
  final String address;
  final String notes;
  final String partnerName;
  final double distanceKm;
  final int amount;
  final int pointsEarned;
  final List<String> serviceNames;
  final String receiptCode;
  final DateTime? scheduledDate;
  final String timeSlot;
  final double? lat;
  final double? lng;
  final double? partnerLat;
  final double? partnerLng;

  List<String> get allServices =>
      serviceNames.isNotEmpty ? serviceNames : (serviceName.isEmpty ? <String>[] : [serviceName]);

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    final service = json['service'];
    final services = json['services'];
    return OrderModel(
      id: json['id'] as int,
      status: json['status'] as String? ?? 'new',
      serviceName: service is Map ? (service['name'] as String? ?? '') : (json['service_name'] as String? ?? ''),
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
      areaSize: json['area_size'] as String? ?? '',
      phoneNumber: json['phone_number'] as String? ?? '',
      address: json['address'] as String? ?? '',
      notes: json['notes'] as String? ?? '',
      partnerName: json['partner_name'] as String? ?? '',
      distanceKm: (json['distance_km'] as num?)?.toDouble() ?? 0,
      amount: json['amount'] as int? ?? 0,
      pointsEarned: json['points_earned'] as int? ?? 0,
      serviceNames: services is List
          ? services.map((e) => e is Map ? '${e['name']}' : '$e').toList()
          : const [],
      receiptCode: json['receipt_code'] as String? ?? 'EM-${json['id']}',
      scheduledDate: DateTime.tryParse(json['scheduled_date'] as String? ?? ''),
      timeSlot: json['time_slot'] as String? ?? '',
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      partnerLat: (json['partner_lat'] as num?)?.toDouble(),
      partnerLng: (json['partner_lng'] as num?)?.toDouble(),
    );
  }

  OrderModel copyWith({String? status}) => OrderModel(
        id: id,
        status: status ?? this.status,
        serviceName: serviceName,
        createdAt: createdAt,
        areaSize: areaSize,
        phoneNumber: phoneNumber,
        address: address,
        notes: notes,
        partnerName: partnerName,
        distanceKm: distanceKm,
        amount: amount,
        pointsEarned: pointsEarned,
        serviceNames: serviceNames,
        receiptCode: receiptCode,
        scheduledDate: scheduledDate,
        timeSlot: timeSlot,
        lat: lat,
        lng: lng,
        partnerLat: partnerLat,
        partnerLng: partnerLng,
      );

  String get statusLabel => switch (status) {
        'new' => 'Yangi',
        'accepted' => 'Qabul qilindi',
        'on_way' => "Yo'lga chiqdi",
        'arrived' => 'Yetib keldi',
        'in_progress' => 'Ishda',
        'done' => 'Tugallandi',
        'cancelled' => 'Bekor qilingan',
        _ => status,
      };

  int get statusStep => switch (status) {
        'new' => 0,
        'accepted' => 1,
        'on_way' => 2,
        'arrived' => 3,
        'in_progress' => 3,
        'done' => 4,
        _ => 0,
      };

  double get progress => statusStep / 4.0;

  static int pointsForAmount(int amountSom) => (amountSom ~/ 100000) * 10;
}

class CarouselItem {
  const CarouselItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.category,
    required this.icon,
    this.serviceSlug,
    this.accent = 0xFF2E7D32,
    this.image = '',
  });

  final int id;
  final String title;
  final String subtitle;
  final String category;
  final String icon;
  final String? serviceSlug;
  final int accent;
  final String image;

  bool get hasImage => image.isNotEmpty;
  bool get isNetworkImage => image.startsWith('http://') || image.startsWith('https://');

  factory CarouselItem.fromJson(Map<String, dynamic> json) => CarouselItem(
        id: json['id'] as int? ?? 0,
        title: json['title'] as String? ?? '',
        subtitle: json['subtitle'] as String? ?? '',
        category: json['category'] as String? ?? '',
        icon: json['icon'] as String? ?? 'eco',
        serviceSlug: json['service_slug'] as String?,
        accent: json['accent'] as int? ?? 0xFF2E7D32,
        image: json['image'] as String? ?? json['image_url'] as String? ?? '',
      );
}

class GalleryItem {
  const GalleryItem({
    required this.before,
    required this.after,
    this.caption = '',
  });

  final String before;
  final String after;
  final String caption;
}

class PartnerReview {
  const PartnerReview({
    required this.id,
    required this.partnerId,
    required this.author,
    required this.stars,
    required this.text,
    required this.createdAt,
  });

  final int id;
  final int partnerId;
  final String author;
  final double stars;
  final String text;
  final DateTime createdAt;
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.partnerId,
    required this.text,
    required this.fromMe,
    required this.createdAt,
  });

  final int id;
  final int partnerId;
  final String text;
  final bool fromMe;
  final DateTime createdAt;
}

class PartnerModel {
  const PartnerModel({
    required this.id,
    required this.name,
    required this.tagline,
    required this.emoji,
    this.activity = '',
    this.address = '',
    this.lat = 41.31,
    this.lng = 69.24,
    this.rating = 4.8,
    this.phone = '',
    this.website = '',
    this.instagram = '',
    this.telegram = '',
    this.workHours = '09:00 – 18:00',
    this.description = '',
    this.logo = '',
    this.gallery = const [],
  });

  final int id;
  final String name;
  final String tagline;
  final String emoji;
  final String logo;
  final String activity;
  final String address;
  final double lat;
  final double lng;
  final double rating;
  final String phone;
  final String website;
  final String instagram;
  final String telegram;
  final String workHours;
  final String description;
  final List<GalleryItem> gallery;

  factory PartnerModel.fromJson(Map<String, dynamic> json) => PartnerModel(
        id: json['id'] as int? ?? 0,
        name: json['name'] as String? ?? '',
        tagline: json['tagline'] as String? ?? '',
        emoji: json['emoji'] as String? ?? '🌿',
        activity: json['activity'] as String? ?? '',
        address: json['address'] as String? ?? '',
        lat: (json['lat'] as num?)?.toDouble() ?? 41.31,
        lng: (json['lng'] as num?)?.toDouble() ?? 69.24,
        rating: (json['rating'] as num?)?.toDouble() ?? 4.8,
        phone: json['phone'] as String? ?? '',
        website: json['website'] as String? ?? '',
        instagram: json['instagram'] as String? ?? '',
        telegram: json['telegram'] as String? ?? '',
        workHours: json['work_hours'] as String? ?? '09:00 – 18:00',
        description: json['description'] as String? ?? '',
        logo: json['logo'] as String? ?? json['logo_url'] as String? ?? '',
      );

  bool get hasLogo => logo.isNotEmpty;
}

class OfferModel {
  const OfferModel({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.kind,
    required this.emoji,
    this.accent = 0xFF2E7D32,
    this.image = '',
  });

  final int id;
  final String title;
  final String subtitle;
  final String kind;
  final String emoji;
  final int accent;
  final String image;

  bool get hasImage => image.isNotEmpty;

  factory OfferModel.fromJson(Map<String, dynamic> json) => OfferModel(
        id: json['id'] as int? ?? 0,
        title: json['title'] as String? ?? '',
        subtitle: json['subtitle'] as String? ?? '',
        kind: json['kind'] as String? ?? 'promo',
        emoji: json['emoji'] as String? ?? '✨',
        accent: json['accent'] as int? ?? 0xFF2E7D32,
        image: json['image'] as String? ?? json['image_url'] as String? ?? '',
      );
}

class AppMessage {
  const AppMessage({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.createdAt,
    this.read = false,
  });

  final int id;
  final String title;
  final String body;
  final String type;
  final DateTime createdAt;
  final bool read;

  AppMessage copyWith({bool? read}) => AppMessage(
        id: id,
        title: title,
        body: body,
        type: type,
        createdAt: createdAt,
        read: read ?? this.read,
      );

  factory AppMessage.fromJson(Map<String, dynamic> json) => AppMessage(
        id: json['id'] as int? ?? 0,
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        type: json['type'] as String? ?? 'system',
        createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
        read: json['read'] as bool? ?? false,
      );
}

class BonusService {
  const BonusService({
    required this.id,
    required this.title,
    required this.costPoints,
    required this.emoji,
  });

  final int id;
  final String title;
  final int costPoints;
  final String emoji;
}
