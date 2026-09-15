class UserProfile {
  UserProfile({
    this.firstName = '',
    this.lastName = '',
    this.birthDate,
    this.avatarPath,
    this.homeAddress = '',
    this.country = '',
    this.region = '',
    this.district = '',
    this.street = '',
    this.locationLat,
    this.locationLng,
    this.additionalPhones = const [],
  });

  String firstName;
  String lastName;
  DateTime? birthDate;
  String? avatarPath;
  String homeAddress;
  String country;
  String region;
  String district;
  String street;
  double? locationLat;
  double? locationLng;
  List<String> additionalPhones;

  String get fullName {
    final parts = [firstName.trim(), lastName.trim()].where((p) => p.isNotEmpty);
    return parts.join(' ');
  }

  String get formattedAddress {
    final parts = [country, region, district, street]
        .where((p) => p.trim().isNotEmpty)
        .toList();
    if (parts.isNotEmpty) return parts.join(', ');
    return homeAddress;
  }

  int? get age {
    if (birthDate == null) return null;
    final now = DateTime.now();
    var years = now.year - birthDate!.year;
    if (now.month < birthDate!.month ||
        (now.month == birthDate!.month && now.day < birthDate!.day)) {
      years--;
    }
    return years;
  }

  bool get isComplete =>
      firstName.trim().isNotEmpty &&
      lastName.trim().isNotEmpty &&
      (formattedAddress.trim().length >= 5 || homeAddress.trim().length >= 5);

  bool get hasAvatar => avatarPath != null && avatarPath!.isNotEmpty;

  bool get hasLocation => locationLat != null && locationLng != null;

  UserProfile copyWith({
    String? firstName,
    String? lastName,
    DateTime? birthDate,
    String? avatarPath,
    String? homeAddress,
    String? country,
    String? region,
    String? district,
    String? street,
    double? locationLat,
    double? locationLng,
    List<String>? additionalPhones,
  }) {
    return UserProfile(
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      birthDate: birthDate ?? this.birthDate,
      avatarPath: avatarPath ?? this.avatarPath,
      homeAddress: homeAddress ?? this.homeAddress,
      country: country ?? this.country,
      region: region ?? this.region,
      district: district ?? this.district,
      street: street ?? this.street,
      locationLat: locationLat ?? this.locationLat,
      locationLng: locationLng ?? this.locationLng,
      additionalPhones: additionalPhones ?? List.from(this.additionalPhones),
    );
  }
}

class UserStats {
  const UserStats({
    required this.plants,
    required this.gardens,
    required this.growthPercent,
  });

  final int plants;
  final int gardens;
  final int growthPercent;

  String get growthLabel => '$growthPercent%';
}
