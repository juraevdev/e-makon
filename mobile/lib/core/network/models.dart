/// Domain models for e-makon.
library;

/// Server raqamlarni int, double yoki (DecimalField) satr ko'rinishida qaytarishi mumkin.
double? asDouble(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v.replaceAll(',', '.'));
  return null;
}

int asInt(dynamic v, [int fallback = 0]) {
  if (v is int) return v;
  if (v is num) return v.round();
  if (v is String) return (double.tryParse(v.replaceAll(',', '.')) ?? fallback).round();
  return fallback;
}

String asStr(dynamic v) => v == null ? '' : '$v';

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
    this.offersCount = 0,
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

  /// Ushbu xizmatni tasdiqlangan narx bilan ko'rsatayotgan firmalar soni.
  final int offersCount;

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
        priceMin: asInt(json['price_min'] ?? json['price']),
        priceMax: asInt(json['price_max'] ?? json['price']),
        image: json['image'] as String? ?? json['image_url'] as String? ?? '',
        offersCount: asInt(json['offers_count']),
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
    this.paymentStatus = 'not_required',
    this.paymentProvider = '',
    this.checkoutUrl = '',
    this.paymentOptions = const {},
    this.firmId,
    this.workStage = '',
    this.workStageLabel = '',
    this.workStageAt,
    this.etaMinutes,
    this.etaAt,
    this.workerName = '',
    this.history = const [],
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

  /// not_required | unpaid | checking | rejected | paid | released | refunded
  final String paymentStatus;
  final String paymentProvider;
  final String checkoutUrl;

  /// Server: qaysi to'lov usullari ulangan — {click: false, payme: false, test: true}.
  final Map<String, bool> paymentOptions;

  bool providerReady(String provider) => paymentOptions[provider] == true;

  /// Click/Payme ulanmagan davrda sinov to'lovi ruxsat etilgan.
  bool get testPaymentAllowed => paymentOptions['test'] == true || paymentOptions.isEmpty;

  final int? firmId;

  /// accepted | on_the_way | arrived | working | finished (bo'sh — firma hali qabul qilmagan)
  final String workStage;
  final String workStageLabel;
  final DateTime? workStageAt;
  final int? etaMinutes;
  final DateTime? etaAt;
  final String workerName;
  final List<OrderStageEvent> history;

  static const workStages = [
    ('accepted', 'Qabul qildi'),
    ('on_the_way', "Yo'lga chiqdi"),
    ('arrived', 'Yetib keldi'),
    ('working', 'Ishlayapti'),
    ('finished', 'Ishni tugatdi'),
  ];

  int get workStageIndex => workStages.indexWhere((s) => s.$1 == workStage);

  bool get isOnTheWay => workStage == 'on_the_way';

  /// Shu bosqichga o'tilgan vaqt (tarixdan).
  DateTime? stageReachedAt(String stage) {
    for (final h in history.reversed) {
      if (h.workStage == stage) return h.createdAt;
    }
    return workStage == stage ? workStageAt : null;
  }

  List<String> get allServices =>
      serviceNames.isNotEmpty ? serviceNames : (serviceName.isEmpty ? <String>[] : [serviceName]);

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    final service = json['service'];
    final services = json['services'];
    final payment = json['payment'];
    final history = json['status_history'];
    return OrderModel(
      id: asInt(json['id']),
      status: json['status'] as String? ?? 'new',
      serviceName: service is Map ? asStr(service['name']) : asStr(json['service_name']),
      createdAt: DateTime.tryParse(asStr(json['created_at'])) ?? DateTime.now(),
      areaSize: asStr(json['area_size']),
      phoneNumber: asStr(json['phone_number']),
      address: asStr(json['address']),
      notes: asStr(json['notes']),
      partnerName: asStr(json['partner_name']),
      distanceKm: asDouble(json['distance_km']) ?? 0,
      amount: asInt(json['amount']),
      pointsEarned: asInt(json['points_earned']),
      serviceNames: services is List
          ? services.map((e) => e is Map ? '${e['name']}' : '$e').toList()
          : const [],
      receiptCode: json['receipt_code'] as String? ?? 'EM-${json['id']}',
      scheduledDate: DateTime.tryParse(asStr(json['scheduled_date'])),
      timeSlot: asStr(json['time_slot']),
      lat: asDouble(json['lat']),
      lng: asDouble(json['lng']),
      partnerLat: asDouble(json['partner_lat']),
      partnerLng: asDouble(json['partner_lng']),
      paymentStatus: json['payment_status'] as String? ?? 'not_required',
      paymentProvider: payment is Map ? asStr(payment['provider']) : '',
      checkoutUrl: payment is Map ? asStr(payment['checkout_url']) : '',
      paymentOptions: json['payment_options'] is Map
          ? {
              for (final e in (json['payment_options'] as Map).entries) '${e.key}': e.value == true,
            }
          : const {},
      firmId: json['firm_id'] == null ? null : asInt(json['firm_id']),
      workStage: asStr(json['work_stage']),
      workStageLabel: asStr(json['work_stage_label']),
      workStageAt: DateTime.tryParse(asStr(json['work_stage_at'])),
      etaMinutes: json['eta_minutes'] == null ? null : asInt(json['eta_minutes']),
      etaAt: DateTime.tryParse(asStr(json['eta_at'])),
      workerName: asStr(json['assigned_worker_name']),
      history: history is List
          ? history.whereType<Map>().map((e) => OrderStageEvent.fromJson(Map<String, dynamic>.from(e))).toList()
          : const [],
    );
  }

  OrderModel copyWith({
    String? status,
    int? amount,
    String? paymentStatus,
    String? paymentProvider,
    String? checkoutUrl,
    Map<String, bool>? paymentOptions,
    double? distanceKm,
    int? firmId,
    String? partnerName,
    String? workStage,
    String? workStageLabel,
    DateTime? workStageAt,
    int? etaMinutes,
    DateTime? etaAt,
    String? workerName,
    List<OrderStageEvent>? history,
  }) =>
      OrderModel(
        id: id,
        status: status ?? this.status,
        serviceName: serviceName,
        createdAt: createdAt,
        areaSize: areaSize,
        phoneNumber: phoneNumber,
        address: address,
        notes: notes,
        partnerName: partnerName ?? this.partnerName,
        distanceKm: distanceKm ?? this.distanceKm,
        amount: amount ?? this.amount,
        pointsEarned: pointsEarned,
        serviceNames: serviceNames,
        receiptCode: receiptCode,
        scheduledDate: scheduledDate,
        timeSlot: timeSlot,
        lat: lat,
        lng: lng,
        partnerLat: partnerLat,
        partnerLng: partnerLng,
        paymentStatus: paymentStatus ?? this.paymentStatus,
        paymentProvider: paymentProvider ?? this.paymentProvider,
        checkoutUrl: checkoutUrl ?? this.checkoutUrl,
        paymentOptions: paymentOptions ?? this.paymentOptions,
        firmId: firmId ?? this.firmId,
        workStage: workStage ?? this.workStage,
        workStageLabel: workStageLabel ?? this.workStageLabel,
        workStageAt: workStageAt ?? this.workStageAt,
        etaMinutes: etaMinutes ?? this.etaMinutes,
        etaAt: etaAt ?? this.etaAt,
        workerName: workerName ?? this.workerName,
        history: history ?? this.history,
      );

  /// Server javobidagi holat, to'lov va ish bosqichi maydonlarini mahalliy (boyitilgan) buyurtmaga qo'shadi.
  OrderModel mergeServer(OrderModel server) => copyWith(
        status: server.status,
        amount: server.amount > 0 ? server.amount : amount,
        paymentStatus: server.paymentStatus,
        paymentProvider: server.paymentProvider,
        checkoutUrl: server.checkoutUrl,
        paymentOptions: server.paymentOptions.isNotEmpty ? server.paymentOptions : paymentOptions,
        distanceKm: server.distanceKm > 0 ? server.distanceKm : distanceKm,
        firmId: server.firmId,
        partnerName: server.partnerName.isNotEmpty ? server.partnerName : partnerName,
        workStage: server.workStage,
        workStageLabel: server.workStageLabel,
        workStageAt: server.workStageAt,
        etaMinutes: server.etaMinutes,
        etaAt: server.etaAt,
        workerName: server.workerName,
        history: server.history,
      );

  bool get needsPayment =>
      isActive && (paymentStatus == 'unpaid' || paymentStatus == 'rejected');

  bool get isPaymentChecking => paymentStatus == 'checking';

  bool get isPaid => paymentStatus == 'paid' || paymentStatus == 'released';

  String get paymentLabel => switch (paymentStatus) {
        'unpaid' => "To'lov kutilmoqda",
        'checking' => "To'lov tekshirilmoqda",
        'rejected' => "To'lov hisobga tushmadi",
        'paid' when paymentProvider == 'test' => "Soxta to'lov qilindi (sinov rejimi)",
        'paid' => "To'landi · tizim hisobida",
        'released' => "To'landi · firmaga o'tkazildi",
        'refunded' => 'Pul qaytarildi',
        _ => "To'lov talab qilinmaydi",
      };

  String get statusLabel => switch (status) {
        'new' => 'Yangi',
        'in_review' => "Ko'rib chiqilmoqda",
        'contacted' => "Bog'lanildi",
        'completed' => 'Bajarildi',
        'cancelled' => 'Bekor qilindi',
        // legacy / demo aliases → backend labels
        'accepted' || 'in_progress' => "Ko'rib chiqilmoqda",
        'on_way' || 'arrived' => "Bog'lanildi",
        'done' => 'Bajarildi',
        _ => status,
      };

  bool get isActive => const {
        'new',
        'in_review',
        'contacted',
        'accepted',
        'on_way',
        'arrived',
        'in_progress',
      }.contains(status);

  bool get isCompleted => status == 'completed' || status == 'done';

  bool get isCancelled => status == 'cancelled';

  bool get canCancel => isActive;

  /// Backend progress: Yangi → Ko'rib chiqilmoqda → Bog'lanildi → Bajarildi
  int get statusStep => switch (status) {
        'new' => 0,
        'in_review' || 'accepted' || 'in_progress' => 1,
        'contacted' || 'on_way' || 'arrived' => 2,
        'completed' || 'done' => 3,
        'cancelled' => -1,
        _ => 0,
      };

  double get progress {
    if (isCancelled) return 0;
    if (isCompleted) return 1;
    final stage = workStageIndex;
    if (stage >= 0) return 0.3 + 0.7 * (stage + 1) / workStages.length;
    return statusStep < 0 ? 0 : (statusStep + 1) / 4.0;
  }

  /// Faol buyurtmada firma bosqichini, aks holda umumiy holatni ko'rsatadi.
  String get displayStatus {
    if (isActive && workStage.isNotEmpty) {
      return workStageLabel.isNotEmpty ? workStageLabel : workStages[workStageIndex.clamp(0, 4)].$2;
    }
    return statusLabel;
  }

  static int pointsForAmount(int amountSom) => (amountSom ~/ 100000) * 10;
}

class OrderStageEvent {
  const OrderStageEvent({
    required this.toStatus,
    required this.workStage,
    required this.label,
    required this.note,
    required this.byName,
    required this.createdAt,
  });

  final String toStatus;
  final String workStage;
  final String label;
  final String note;
  final String byName;
  final DateTime createdAt;

  factory OrderStageEvent.fromJson(Map<String, dynamic> json) => OrderStageEvent(
        toStatus: asStr(json['to_status']),
        workStage: asStr(json['stage']),
        label: asStr(json['stage_label']),
        note: asStr(json['note']),
        byName: asStr(json['changed_by_name']),
        createdAt: DateTime.tryParse(asStr(json['created_at']))?.toLocal() ?? DateTime.now(),
      );
}

/// Firmaning muayyan xizmat uchun tasdiqlangan qat'iy narxi.
class PartnerOffer {
  const PartnerOffer({required this.serviceId, required this.name, required this.price, this.duration = ''});

  final int serviceId;
  final String name;
  final int price;
  final String duration;

  factory PartnerOffer.fromJson(Map<String, dynamic> json) => PartnerOffer(
        serviceId: asInt(json['service_id']),
        name: asStr(json['name']),
        price: asInt(json['price']),
        duration: asStr(json['duration']),
      );
}

class PartnerSocial {
  const PartnerSocial({required this.kind, required this.label, required this.url});

  /// telegram_channel | telegram_group | instagram | youtube | facebook | website
  final String kind;
  final String label;
  final String url;

  factory PartnerSocial.fromJson(Map<String, dynamic> json) =>
      PartnerSocial(kind: asStr(json['kind']), label: asStr(json['label']), url: asStr(json['url']));
}

/// `/services/{slug}/offers/` qatori — firma va uning narxi.
class ServiceOffer {
  const ServiceOffer({
    required this.serviceId,
    required this.name,
    required this.price,
    this.slug = '',
    this.duration = '',
    this.description = '',
    this.firm,
  });

  final int serviceId;
  final String slug;
  final String name;
  final int price;
  final String duration;
  final String description;
  final PartnerModel? firm;

  factory ServiceOffer.fromJson(Map<String, dynamic> json) {
    final firm = json['firm'];
    return ServiceOffer(
      serviceId: asInt(json['service_id']),
      slug: asStr(json['slug']),
      name: asStr(json['name']),
      price: asInt(json['price']),
      duration: asStr(json['duration']),
      description: asStr(json['description']),
      firm: firm is Map ? PartnerModel.fromJson(Map<String, dynamic>.from(firm)) : null,
    );
  }
}

class ChatRoomModel {
  const ChatRoomModel({
    required this.id,
    required this.firmId,
    required this.firmName,
    this.firmPhone = '',
    this.lastMessageAt,
    this.lastMessagePreview = '',
    this.unread = 0,
  });

  final int id;
  final int firmId;
  final String firmName;
  final String firmPhone;
  final DateTime? lastMessageAt;
  final String lastMessagePreview;
  final int unread;

  factory ChatRoomModel.fromJson(Map<String, dynamic> json) => ChatRoomModel(
        id: asInt(json['id']),
        firmId: asInt(json['firm_id']),
        firmName: asStr(json['firm_name']),
        firmPhone: asStr(json['firm_phone']),
        lastMessageAt: DateTime.tryParse(asStr(json['last_message_at']))?.toLocal(),
        lastMessagePreview: asStr(json['last_message_preview']),
        unread: asInt(json['unread']),
      );
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
    this.senderRole = '',
    this.senderName = '',
    this.pending = false,
  });

  final int id;
  final int partnerId;
  final String text;
  final bool fromMe;
  final DateTime createdAt;

  /// customer | firm | platform
  final String senderRole;
  final String senderName;
  final bool pending;

  bool get fromPlatform => senderRole == 'platform';

  factory ChatMessage.fromJson(Map<String, dynamic> json, {required int partnerId}) => ChatMessage(
        id: asInt(json['id']),
        partnerId: partnerId,
        text: asStr(json['body']),
        fromMe: json['mine'] == true || json['sender_role'] == 'customer',
        createdAt: DateTime.tryParse(asStr(json['created_at']))?.toLocal() ?? DateTime.now(),
        senderRole: asStr(json['sender_role']),
        senderName: asStr(json['sender_name']),
      );
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
    this.socials = const [],
    this.servicesCount = 0,
    this.ratingsCount = 0,
    this.offer,
    this.fromServer = false,
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

  /// Telegram kanal/guruh, Instagram, YouTube… — firma admin panelida belgilaydi.
  final List<PartnerSocial> socials;
  final int servicesCount;
  final int ratingsCount;

  /// `/partners/?service=` so'rovida — shu xizmat uchun firma narxi.
  final PartnerOffer? offer;

  /// Haqiqiy firma (server) — chat va buyurtma firmaga bog'lanadi.
  final bool fromServer;

  factory PartnerModel.fromJson(Map<String, dynamic> json) {
    final socials = json['socials'];
    final offer = json['offer'];
    final hours = asStr(json['work_hours']);
    return PartnerModel(
      id: asInt(json['id']),
      name: asStr(json['name']),
      tagline: asStr(json['tagline']),
      emoji: json['emoji'] as String? ?? '🌿',
      activity: asStr(json['activity']),
      address: asStr(json['address']),
      lat: asDouble(json['lat']) ?? 41.31,
      lng: asDouble(json['lng']) ?? 69.24,
      rating: asDouble(json['rating']) ?? 4.8,
      phone: asStr(json['phone']),
      website: asStr(json['website']),
      instagram: asStr(json['instagram']),
      telegram: asStr(json['telegram']),
      workHours: hours.isEmpty ? '09:00 – 18:00' : hours,
      description: asStr(json['description']),
      logo: json['logo'] as String? ?? json['logo_url'] as String? ?? '',
      socials: socials is List
          ? socials.whereType<Map>().map((e) => PartnerSocial.fromJson(Map<String, dynamic>.from(e))).toList()
          : const [],
      servicesCount: asInt(json['services_count']),
      ratingsCount: asInt(json['ratings_count']),
      offer: offer is Map ? PartnerOffer.fromJson(Map<String, dynamic>.from(offer)) : null,
      fromServer: true,
    );
  }

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
    this.entityType = '',
    this.entityId,
  });

  final int id;
  final String title;
  final String body;

  /// order | chat | care | offer | bonus | system | subscription
  final String type;
  final DateTime createdAt;
  final bool read;

  /// order | chat_room | care_contract — bildirishnoma qaysi obyektga tegishli.
  final String entityType;
  final int? entityId;

  AppMessage copyWith({bool? read}) => AppMessage(
        id: id,
        title: title,
        body: body,
        type: type,
        createdAt: createdAt,
        read: read ?? this.read,
        entityType: entityType,
        entityId: entityId,
      );

  factory AppMessage.fromJson(Map<String, dynamic> json) => AppMessage(
        id: asInt(json['id']),
        title: asStr(json['title']),
        body: asStr(json['body']),
        type: json['type'] as String? ?? 'system',
        createdAt: DateTime.tryParse(asStr(json['created_at']))?.toLocal() ?? DateTime.now(),
        read: json['read'] as bool? ?? false,
        entityType: asStr(json['entity_type']),
        entityId: json['entity_id'] == null ? null : asInt(json['entity_id']),
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
