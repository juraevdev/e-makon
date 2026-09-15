class CompanyInfo {
  CompanyInfo._();

  static const String name = 'My Garden';
  static const String tagline = "Bog'ingiz go'zalligi — bizning ishimiz";
  static const String description =
      "My Garden — O'zbekistonda landshaft dizayn, bog' parvarishi va sug'orish tizimlari bo'yicha yetakchi kompaniya. 10 yildan ortiq tajriba va 500+ mamnun mijoz.";
  static const String address =
      "Toshkent shahri, Yunusobod tumani, Amir Temur ko'chasi 45";
  static const String workingHours = 'Dushanba — Shanba: 09:00 — 18:00';
  static const String email = 'info@mygarden.uz';
  static const String website = 'www.mygarden.uz';

  static const List<AdminContact> admins = [
    AdminContact(
      name: 'Sardor Karimov',
      role: 'Bosh menejer',
      phone: '+998 90 123 45 67',
    ),
    AdminContact(
      name: 'Dilnoza Rahimova',
      role: 'Mijozlar bilan ishlash',
      phone: '+998 91 234 56 78',
    ),
    AdminContact(
      name: 'Jasur Toshmatov',
      role: 'Texnik mutaxassis',
      phone: '+998 93 345 67 89',
    ),
  ];
}

class AdminContact {
  const AdminContact({
    required this.name,
    required this.role,
    required this.phone,
  });

  final String name;
  final String role;
  final String phone;
}
