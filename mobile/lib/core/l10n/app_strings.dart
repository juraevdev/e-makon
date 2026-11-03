import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

import '../settings/app_settings.dart';
import 'app_language.dart';

extension L10nX on BuildContext {
  AppStrings get l10n => watch<AppSettings>().strings;
  AppStrings get l10nRead => read<AppSettings>().strings;
}

class AppStrings {
  const AppStrings._(this._m);
  final Map<String, String> _m;

  String _t(String key) => _m[key] ?? key;

  // —— Nav / common ——
  String get appName => _t('appName');
  String get navHome => _t('navHome');
  String get navHomeShort => _t('navHomeShort');
  String get navOrders => _t('navOrders');
  String get navOrdersShort => _t('navOrdersShort');
  String get navChat => _t('navChat');
  String get navChatShort => _t('navChatShort');
  String get navProfile => _t('navProfile');
  String get cancel => _t('cancel');
  String get save => _t('save');
  String get edit => _t('edit');
  String get logout => _t('logout');
  String get settings => _t('settings');
  String get theme => _t('theme');
  String get language => _t('language');
  String get themeDark => _t('themeDark');
  String get themeLight => _t('themeLight');
  String get themeSystem => _t('themeSystem');
  String get appearance => _t('appearance');
  String get done => _t('done');
  String get retry => _t('retry');
  String get loading => _t('loading');
  String get search => _t('search');
  String get seeAll => _t('seeAll');
  String get user => _t('user');
  String get points => _t('points');
  String get close => _t('close');
  String get continueAction => _t('continue');
  String get confirm => _t('confirm');
  String get delete => _t('delete');
  String get yes => _t('yes');
  String get no => _t('no');
  String get error => _t('error');
  String get success => _t('success');

  // —— Profile ——
  String get profile => _t('profile');
  String get profileSaved => _t('profileSaved');
  String get avatarUpdated => _t('avatarUpdated');
  String get avatarFailed => _t('avatarFailed');
  String get gpsUnavailable => _t('gpsUnavailable');
  String get addressDetected => _t('addressDetected');
  String get favorites => _t('favorites');
  String get favoriteServices => _t('favoriteServices');
  String get favoritePartners => _t('favoritePartners');
  String get noFavorites => _t('noFavorites');
  String get activeOrders => _t('activeOrders');
  String get loyalty => _t('loyalty');
  String get firstName => _t('firstName');
  String get lastName => _t('lastName');
  String get company => _t('company');
  String get email => _t('email');
  String get address => _t('address');
  String get detectGps => _t('detectGps');
  String get personalInfo => _t('personalInfo');
  String get livingAddress => _t('livingAddress');

  // —— Auth ——
  String get login => _t('login');
  String get register => _t('register');
  String get phone => _t('phone');
  String get enterPhone => _t('enterPhone');
  String get sendCode => _t('sendCode');
  String get otpTitle => _t('otpTitle');
  String get otpHint => _t('otpHint');
  String get otpDemoHint => _t('otpDemoHint');
  String get verify => _t('verify');
  String get wrongCode => _t('wrongCode');
  String get alreadyHaveAccount => _t('alreadyHaveAccount');
  String get noAccount => _t('noAccount');
  String get welcomeBack => _t('welcomeBack');
  String get createAccount => _t('createAccount');

  // —— Home ——
  String get homeTitle => _t('homeTitle');
  String get services => _t('services');
  String get partners => _t('partners');
  String get offers => _t('offers');
  String get nearestOffices => _t('nearestOffices');
  String get nearestFirms => _t('nearestFirms');
  String get popularServices => _t('popularServices');
  String get shop => _t('shop');
  String get shopSubtitle => _t('shopSubtitle');
  String get navShop => _t('navShop');
  String get navScanner => _t('navScanner');
  String get searchServices => _t('searchServices');
  String get noServices => _t('noServices');
  String get kmAway => _t('kmAway');
  String get fromPrice => _t('fromPrice');
  String get buy => _t('buy');
  String get flowers => _t('flowers');
  String get fertilizers => _t('fertilizers');
  String get tools => _t('tools');
  String get noProducts => _t('noProducts');
  String get quantity => _t('quantity');
  String get deliveryAddress => _t('deliveryAddress');
  String get enterDeliveryAddress => _t('enterDeliveryAddress');
  String get orderNotes => _t('orderNotes');
  String get orderNotesHint => _t('orderNotesHint');
  String get confirmPurchase => _t('confirmPurchase');
  String get totalAmount => _t('totalAmount');

  // —— Plant scanner ——
  String get plantScanner => _t('plantScanner');
  String get plantScannerSubtitle => _t('plantScannerSubtitle');
  String get plantScanHero => _t('plantScanHero');
  String get plantScanHeroBody => _t('plantScanHeroBody');
  String get scanWithCamera => _t('scanWithCamera');
  String get pickFromGallery => _t('pickFromGallery');
  String get whatWeDetect => _t('whatWeDetect');
  String get diseases => _t('diseases');
  String get diseasesHint => _t('diseasesHint');
  String get harmfulAgents => _t('harmfulAgents');
  String get harmfulAgentsHint => _t('harmfulAgentsHint');
  String get deficiencies => _t('deficiencies');
  String get deficienciesHint => _t('deficienciesHint');
  String get analyzingPlant => _t('analyzingPlant');
  String get analyzingPlantHint => _t('analyzingPlantHint');
  String get scanAgain => _t('scanAgain');
  String get healthScore => _t('healthScore');
  String get noDiseasesFound => _t('noDiseasesFound');
  String get noHarmfulFound => _t('noHarmfulFound');
  String get noDeficienciesFound => _t('noDeficienciesFound');
  String get careTips => _t('careTips');
  String get advice => _t('advice');
  String get severityHigh => _t('severityHigh');
  String get severityMedium => _t('severityMedium');
  String get severityLow => _t('severityLow');
  String get getHelpService => _t('getHelpService');
  String get shopRemedies => _t('shopRemedies');
  String get plantScanDisclaimer => _t('plantScanDisclaimer');
  String get plantScanFailed => _t('plantScanFailed');
  String get plantScanWebNote => _t('plantScanWebNote');
  String get openPlantScanner => _t('openPlantScanner');

  // —— Orders ——
  String get orders => _t('orders');
  String get all => _t('all');
  String get active => _t('active');
  String get completed => _t('completed');
  String get cancelled => _t('cancelled');
  String get noOrders => _t('noOrders');
  String get orderDetail => _t('orderDetail');
  String get orderSuccess => _t('orderSuccess');
  String get payment => _t('payment');
  String get payNow => _t('payNow');
  String get orderAgain => _t('orderAgain');
  String get statusPending => _t('statusPending');
  String get statusAccepted => _t('statusAccepted');
  String get statusInProgress => _t('statusInProgress');
  String get statusCompleted => _t('statusCompleted');
  String get statusCancelled => _t('statusCancelled');

  // —— Chat / messages ——
  String get messages => _t('messages');
  String get noMessages => _t('noMessages');
  String get typeMessage => _t('typeMessage');
  String get notifications => _t('notifications');

  // —— Order flow ——
  String get bookService => _t('bookService');
  String get chooseDate => _t('chooseDate');
  String get chooseTime => _t('chooseTime');
  String get areaSize => _t('areaSize');
  String get measureArea => _t('measureArea');
  String get next => _t('next');
  String get back => _t('back');
  String get submitOrder => _t('submitOrder');

  // —— Seasons ——
  String get seasonSpring => _t('seasonSpring');
  String get seasonSummer => _t('seasonSummer');
  String get seasonAutumn => _t('seasonAutumn');
  String get seasonWinter => _t('seasonWinter');
  String get seasonSpringSub => _t('seasonSpringSub');
  String get seasonSummerSub => _t('seasonSummerSub');
  String get seasonAutumnSub => _t('seasonAutumnSub');
  String get seasonWinterSub => _t('seasonWinterSub');

  // —— Onboarding ——
  String get getStarted => _t('getStarted');
  String get skip => _t('skip');

  static AppStrings of(AppLanguage lang) => AppStrings._(_tables[lang]!);

  static final Map<AppLanguage, Map<String, String>> _tables = {
    AppLanguage.uzLatn: _uzLatn,
    AppLanguage.uzCyrl: _uzCyrl,
    AppLanguage.ru: _ru,
    AppLanguage.en: _en,
  };

  static const _uzLatn = {
    'appName': 'e-makon',
    'navHome': 'Bosh sahifa',
    'navHomeShort': 'Bosh',
    'navOrders': 'Buyurtmalar',
    'navOrdersShort': 'Buyurtma',
    'navChat': 'Xabarlar',
    'navChatShort': 'Xabar',
    'navProfile': 'Profil',
    'cancel': 'Bekor',
    'save': 'Saqlash',
    'edit': 'Tahrirlash',
    'logout': 'Chiqish',
    'settings': 'Sozlamalar',
    'theme': 'Mavzu',
    'language': 'Til',
    'themeDark': 'Qorong‘u',
    'themeLight': 'Yorug‘',
    'themeSystem': 'Tizim',
    'appearance': 'Ko‘rinish',
    'done': 'Tayyor',
    'retry': 'Qayta urinish',
    'loading': 'Yuklanmoqda…',
    'search': 'Qidirish',
    'seeAll': 'Barchasi',
    'user': 'Foydalanuvchi',
    'points': 'ball',
    'close': 'Yopish',
    'continue': 'Davom etish',
    'confirm': 'Tasdiqlash',
    'delete': 'O‘chirish',
    'yes': 'Ha',
    'no': "Yo‘q",
    'error': 'Xato',
    'success': 'Muvaffaqiyatli',
    'profile': 'Profil',
    'profileSaved': 'Profil saqlandi',
    'avatarUpdated': 'Profil rasmi yangilandi',
    'avatarFailed': 'Rasm yuklanmadi',
    'gpsUnavailable': 'GPS ruxsati yoki xizmati yoqilmagan',
    'addressDetected': 'Manzil GPS orqali aniqlandi',
    'favorites': 'Sevimlilar',
    'favoriteServices': 'Sevimli xizmatlar',
    'favoritePartners': 'Sevimli hamkorlar',
    'noFavorites': 'Sevimlilar yo‘q',
    'activeOrders': 'Faol buyurtmalar',
    'loyalty': 'Ballar',
    'firstName': 'Ism',
    'lastName': 'Familiya',
    'company': 'Kompaniya',
    'email': 'Email',
    'address': 'Manzil',
    'detectGps': 'GPS aniqlash',
    'personalInfo': 'Shaxsiy ma’lumot',
    'livingAddress': 'Yashash manzili',
    'login': 'Kirish',
    'register': "Ro‘yxatdan o‘tish",
    'phone': 'Telefon',
    'enterPhone': 'Telefon raqamingizni kiriting',
    'sendCode': 'Kod yuborish',
    'otpTitle': 'Tasdiqlash kodi',
    'otpHint': 'SMS orqali kelgan kodni kiriting',
    'otpDemoHint': 'SMS ulanmagan — demo kod: 123456',
    'verify': 'Tasdiqlash',
    'wrongCode': 'Kod noto‘g‘ri',
    'alreadyHaveAccount': 'Hisobingiz bormi?',
    'noAccount': "Hisobingiz yo‘qmi?",
    'welcomeBack': 'Xush kelibsiz',
    'createAccount': 'Hisob yaratish',
    'homeTitle': 'Bosh sahifa',
    'services': 'Xizmatlar',
    'partners': 'Hamkorlar',
    'offers': 'Takliflar',
    'nearestOffices': 'Yaqin ofislar',
    'nearestFirms': 'Yaqin firmalar',
    'popularServices': 'Ommabop xizmatlar',
    'shop': 'Savdo',
    'shopSubtitle': 'Gul, o‘g‘it va uskunalar',
    'navShop': 'Xarid',
    'navScanner': 'Skaner',
    'searchServices': 'Xizmat qidirish',
    'noServices': 'Xizmatlar topilmadi',
    'kmAway': 'km',
    'fromPrice': 'dan',
    'buy': 'Sotib olish',
    'flowers': 'Gullar',
    'fertilizers': "O‘g‘itlar",
    'tools': 'Uskunalar',
    'noProducts': 'Mahsulot topilmadi',
    'quantity': 'Miqdor',
    'deliveryAddress': 'Yetkazish manzili',
    'enterDeliveryAddress': 'Manzilni kiriting',
    'orderNotes': 'Izoh',
    'orderNotesHint': 'Yetkazish vaqti yoki qo‘shimcha izoh',
    'confirmPurchase': 'Buyurtmani tasdiqlash',
    'totalAmount': 'Jami',
    'plantScanner': 'O‘simlik skaner',
    'plantScannerSubtitle': 'Kasallik, zarar va yetishmovchilik',
    'plantScanHero': 'O‘simlikni skanerlang',
    'plantScanHeroBody': 'Rasm oling — kasalliklar, zararli hasharotlar va yetishmayotgan ozuqalar chiqadi.',
    'scanWithCamera': 'Kamera bilan skanerlash',
    'pickFromGallery': 'Galereyadan tanlash',
    'whatWeDetect': 'Nimalarni aniqlaymiz',
    'diseases': 'Kasalliklar',
    'diseasesHint': 'Zamburug‘, bakteriya va boshqa barg/poya kasalliklari',
    'harmfulAgents': 'Zararli omillar',
    'harmfulAgentsHint': 'Hasharotlar, zararkunandalar va toksik ta’sirlar',
    'deficiencies': 'Yetishmovchiliklar',
    'deficienciesHint': 'Azot, kaliy, kalsiy va boshqa ozuqalar',
    'analyzingPlant': 'Tahlil qilinmoqda…',
    'analyzingPlantHint': 'Barg, rang va dog‘lar bo‘yicha tekshiryapmiz',
    'scanAgain': 'Qayta skaner',
    'healthScore': 'Sog‘liq bahosi',
    'noDiseasesFound': 'Kasallik belgisi topilmadi',
    'noHarmfulFound': 'Zararli omil topilmadi',
    'noDeficienciesFound': 'Yetishmovchilik topilmadi',
    'careTips': 'Parvarish maslahatlari',
    'advice': 'Tavsiya',
    'severityHigh': 'Yuqori',
    'severityMedium': 'O‘rtacha',
    'severityLow': 'Past',
    'getHelpService': 'Mutaxassis chaqirish',
    'shopRemedies': 'Savdoda vositalar',
    'plantScanDisclaimer': 'Natija dastlabki baholash. Aniq tashxis uchun agronom yoki mutaxassisga murojaat qiling.',
    'plantScanFailed': 'Rasmni ochib bo‘lmadi. Qayta urinib ko‘ring.',
    'plantScanWebNote': 'Brauzerda kamera ruxsati so‘ralishi mumkin.',
    'openPlantScanner': 'O‘simlikni tekshirish',
    'orders': 'Buyurtmalar',
    'all': 'Barchasi',
    'active': 'Faol',
    'completed': 'Tugallangan',
    'cancelled': 'Bekor qilingan',
    'noOrders': 'Buyurtmalar yo‘q',
    'orderDetail': 'Buyurtma tafsiloti',
    'orderSuccess': 'Buyurtma qabul qilindi',
    'payment': "To‘lov",
    'payNow': "To‘lash",
    'orderAgain': 'Qayta buyurtma',
    'statusPending': 'Kutilmoqda',
    'statusAccepted': 'Qabul qilindi',
    'statusInProgress': 'Jarayonda',
    'statusCompleted': 'Tugallandi',
    'statusCancelled': 'Bekor qilindi',
    'messages': 'Xabarlar',
    'noMessages': 'Xabarlar yo‘q',
    'typeMessage': 'Xabar yozing…',
    'notifications': 'Bildirishnomalar',
    'bookService': 'Buyurtma berish',
    'chooseDate': 'Sanani tanlang',
    'chooseTime': 'Vaqtni tanlang',
    'areaSize': 'Maydon',
    'measureArea': 'Maydonni o‘lchash',
    'next': 'Keyingi',
    'back': 'Orqaga',
    'submitOrder': 'Buyurtmani yuborish',
    'seasonSpring': 'Bahor',
    'seasonSummer': 'Yoz',
    'seasonAutumn': 'Kuz',
    'seasonWinter': 'Qish',
    'seasonSpringSub': 'Gullar ochilmoqda',
    'seasonSummerSub': 'Mevalar pishmoqda',
    'seasonAutumnSub': "Barglar to‘kilmoqda",
    'seasonWinterSub': 'Dam olish fasli',
    'getStarted': 'Boshlash',
    'skip': "O‘tkazib yuborish",
  };

  static const _uzCyrl = {
    'appName': 'e-makon',
    'navHome': 'Бош саҳифа',
    'navHomeShort': 'Бош',
    'navOrders': 'Буюртмалар',
    'navOrdersShort': 'Буюртма',
    'navChat': 'Хабарлар',
    'navChatShort': 'Хабар',
    'navProfile': 'Профил',
    'cancel': 'Бекор',
    'save': 'Сақлаш',
    'edit': 'Таҳрирлаш',
    'logout': 'Чиқиш',
    'settings': 'Созламалар',
    'theme': 'Мавзу',
    'language': 'Тил',
    'themeDark': 'Қоронғу',
    'themeLight': 'Ёруғ',
    'themeSystem': 'Тизим',
    'appearance': 'Кўриниш',
    'done': 'Тайёр',
    'retry': 'Қайта уриниш',
    'loading': 'Юкланмоқда…',
    'search': 'Қидириш',
    'seeAll': 'Барчаси',
    'user': 'Фойдаланувчи',
    'points': 'балл',
    'close': 'Ёпиш',
    'continue': 'Давом этиш',
    'confirm': 'Тасдиқлаш',
    'delete': 'Ўчириш',
    'yes': 'Ҳа',
    'no': 'Йўқ',
    'error': 'Хато',
    'success': 'Муваффақиятли',
    'profile': 'Профил',
    'profileSaved': 'Профил сақланди',
    'avatarUpdated': 'Профил расми янгиланди',
    'avatarFailed': 'Расм юкланмади',
    'gpsUnavailable': 'GPS рухсати ёки хизмати ёқилмаган',
    'addressDetected': 'Манзил GPS орқали аниқланди',
    'favorites': 'Севимлилар',
    'favoriteServices': 'Севимли хизматлар',
    'favoritePartners': 'Севимли ҳамкорлар',
    'noFavorites': 'Севимлилар йўқ',
    'activeOrders': 'Фаол буюртмалар',
    'loyalty': 'Баллар',
    'firstName': 'Исм',
    'lastName': 'Фамилия',
    'company': 'Компания',
    'email': 'Email',
    'address': 'Манзил',
    'detectGps': 'GPS аниқлаш',
    'personalInfo': 'Шахсий маълумот',
    'livingAddress': 'Яшаш манзили',
    'login': 'Кириш',
    'register': 'Рўйхатдан ўтиш',
    'phone': 'Телефон',
    'enterPhone': 'Телефон рақамингизни киритинг',
    'sendCode': 'Код юбориш',
    'otpTitle': 'Тасдиқлаш коди',
    'otpHint': 'SMS орқали келган кодни киритинг',
    'otpDemoHint': 'SMS уланмаган — демо код: 123456',
    'verify': 'Тасдиқлаш',
    'wrongCode': 'Код нотўғри',
    'alreadyHaveAccount': 'Ҳисобингиз борми?',
    'noAccount': 'Ҳисобингиз йўқми?',
    'welcomeBack': 'Хуш келибсиз',
    'createAccount': 'Ҳисоб яратиш',
    'homeTitle': 'Бош саҳифа',
    'services': 'Хизматлар',
    'partners': 'Ҳамкорлар',
    'offers': 'Таклифлар',
    'nearestOffices': 'Яқин офислар',
    'nearestFirms': 'Яқин фирмалар',
    'popularServices': 'Оммабоп хизматлар',
    'shop': 'Савдо',
    'shopSubtitle': 'Гул, ўғит ва ускуналар',
    'navShop': 'Харид',
    'navScanner': 'Сканер',
    'searchServices': 'Хизмат қидириш',
    'noServices': 'Хизматлар топилмади',
    'kmAway': 'км',
    'fromPrice': 'дан',
    'buy': 'Сотиб олиш',
    'flowers': 'Гуллар',
    'fertilizers': 'Ўғитлар',
    'tools': 'Ускуналар',
    'noProducts': 'Маҳсулот топилмади',
    'quantity': 'Миқдор',
    'deliveryAddress': 'Етказиш манзили',
    'enterDeliveryAddress': 'Манзилни киритинг',
    'orderNotes': 'Изоҳ',
    'orderNotesHint': 'Етказиш вақти ёки қўшимча изоҳ',
    'confirmPurchase': 'Буюртмани тасдиқлаш',
    'totalAmount': 'Жами',
    'plantScanner': 'Ўсимлик сканер',
    'plantScannerSubtitle': 'Касаллик, зарар ва етишмовчилик',
    'plantScanHero': 'Ўсимликни сканерланг',
    'plantScanHeroBody': 'Расм олинг — касалликлар, зарарли ҳашаротлар ва етишмаётган озуқалар чиқади.',
    'scanWithCamera': 'Камера билан сканерлаш',
    'pickFromGallery': 'Галереядан танлаш',
    'whatWeDetect': 'Нималарни аниқлаймиз',
    'diseases': 'Касалликлар',
    'diseasesHint': 'Замбуруғ, бактерия ва бошқа барг/поя касалликлари',
    'harmfulAgents': 'Зарарли омиллар',
    'harmfulAgentsHint': 'Ҳашаротлар, зараркунандалар ва токсик таъсирлар',
    'deficiencies': 'Етишмовчиликлар',
    'deficienciesHint': 'Азот, калий, кальций ва бошқа озуқалар',
    'analyzingPlant': 'Таҳлил қилинмоқда…',
    'analyzingPlantHint': 'Барг, ранг ва доғлар бўйича текширяпмиз',
    'scanAgain': 'Қайта сканер',
    'healthScore': 'Соғлиқ баҳоси',
    'noDiseasesFound': 'Касаллик белгиси топилмади',
    'noHarmfulFound': 'Зарарли омил топилмади',
    'noDeficienciesFound': 'Етишмовчилик топилмади',
    'careTips': 'Парвариш маслаҳатлари',
    'advice': 'Тавсия',
    'severityHigh': 'Юқори',
    'severityMedium': 'Ўртача',
    'severityLow': 'Паст',
    'getHelpService': 'Мутахассис чақириш',
    'shopRemedies': 'Савдода воситалар',
    'plantScanDisclaimer': 'Натижа дастлабки баҳолаш. Аниқ ташхис учун агрономга мурожаат қилинг.',
    'plantScanFailed': 'Расмни очиб бўлмади. Қайта уриниб кўринг.',
    'plantScanWebNote': 'Браузерда камера рухсати сўралиши мумкин.',
    'openPlantScanner': 'Ўсимликни текшириш',
    'orders': 'Буюртмалар',
    'all': 'Барчаси',
    'active': 'Фаол',
    'completed': 'Тугалланган',
    'cancelled': 'Бекор қилинган',
    'noOrders': 'Буюртмалар йўқ',
    'orderDetail': 'Буюртма тафсилоти',
    'orderSuccess': 'Буюртма қабул қилинди',
    'payment': 'Тўлов',
    'payNow': 'Тўлаш',
    'orderAgain': 'Қайта буюртма',
    'statusPending': 'Кутилмоқда',
    'statusAccepted': 'Қабул қилинди',
    'statusInProgress': 'Жараёнда',
    'statusCompleted': 'Тугалланди',
    'statusCancelled': 'Бекор қилинди',
    'messages': 'Хабарлар',
    'noMessages': 'Хабарлар йўқ',
    'typeMessage': 'Хабар ёзинг…',
    'notifications': 'Билдиришномалар',
    'bookService': 'Буюртма бериш',
    'chooseDate': 'Санани танланг',
    'chooseTime': 'Вақтни танланг',
    'areaSize': 'Майдон',
    'measureArea': 'Майдонни ўлчаш',
    'next': 'Кейинги',
    'back': 'Орқага',
    'submitOrder': 'Буюртмани юбориш',
    'seasonSpring': 'Баҳор',
    'seasonSummer': 'Ёз',
    'seasonAutumn': 'Куз',
    'seasonWinter': 'Қиш',
    'seasonSpringSub': 'Гуллар очилмоқда',
    'seasonSummerSub': 'Мевалар пишмоқда',
    'seasonAutumnSub': 'Барглар тўкилмоқда',
    'seasonWinterSub': 'Дам олиш фасли',
    'getStarted': 'Бошлаш',
    'skip': 'Ўтказиб юбориш',
  };

  static const _ru = {
    'appName': 'e-makon',
    'navHome': 'Главная',
    'navHomeShort': 'Дом',
    'navOrders': 'Заказы',
    'navOrdersShort': 'Заказ',
    'navChat': 'Сообщения',
    'navChatShort': 'Чат',
    'navProfile': 'Профиль',
    'cancel': 'Отмена',
    'save': 'Сохранить',
    'edit': 'Изменить',
    'logout': 'Выйти',
    'settings': 'Настройки',
    'theme': 'Тема',
    'language': 'Язык',
    'themeDark': 'Тёмная',
    'themeLight': 'Светлая',
    'themeSystem': 'Системная',
    'appearance': 'Оформление',
    'done': 'Готово',
    'retry': 'Повторить',
    'loading': 'Загрузка…',
    'search': 'Поиск',
    'seeAll': 'Все',
    'user': 'Пользователь',
    'points': 'баллов',
    'close': 'Закрыть',
    'continue': 'Продолжить',
    'confirm': 'Подтвердить',
    'delete': 'Удалить',
    'yes': 'Да',
    'no': 'Нет',
    'error': 'Ошибка',
    'success': 'Успешно',
    'profile': 'Профиль',
    'profileSaved': 'Профиль сохранён',
    'avatarUpdated': 'Фото профиля обновлено',
    'avatarFailed': 'Не удалось загрузить фото',
    'gpsUnavailable': 'GPS недоступен или нет разрешения',
    'addressDetected': 'Адрес определён по GPS',
    'favorites': 'Избранное',
    'favoriteServices': 'Избранные услуги',
    'favoritePartners': 'Избранные партнёры',
    'noFavorites': 'Нет избранного',
    'activeOrders': 'Активные заказы',
    'loyalty': 'Баллы',
    'firstName': 'Имя',
    'lastName': 'Фамилия',
    'company': 'Компания',
    'email': 'Email',
    'address': 'Адрес',
    'detectGps': 'Определить GPS',
    'personalInfo': 'Личные данные',
    'livingAddress': 'Адрес проживания',
    'login': 'Вход',
    'register': 'Регистрация',
    'phone': 'Телефон',
    'enterPhone': 'Введите номер телефона',
    'sendCode': 'Отправить код',
    'otpTitle': 'Код подтверждения',
    'otpHint': 'Введите код из SMS',
    'otpDemoHint': 'SMS не подключен — демо-код: 123456',
    'verify': 'Подтвердить',
    'wrongCode': 'Неверный код',
    'alreadyHaveAccount': 'Уже есть аккаунт?',
    'noAccount': 'Нет аккаунта?',
    'welcomeBack': 'С возвращением',
    'createAccount': 'Создать аккаунт',
    'homeTitle': 'Главная',
    'services': 'Услуги',
    'partners': 'Партнёры',
    'offers': 'Предложения',
    'nearestOffices': 'Ближайшие офисы',
    'nearestFirms': 'Ближайшие фирмы',
    'popularServices': 'Популярные услуги',
    'shop': 'Магазин',
    'shopSubtitle': 'Цветы, удобрения и инструменты',
    'navShop': 'Покупки',
    'navScanner': 'Сканер',
    'searchServices': 'Поиск услуг',
    'noServices': 'Услуги не найдены',
    'kmAway': 'км',
    'fromPrice': 'от',
    'buy': 'Купить',
    'flowers': 'Цветы',
    'fertilizers': 'Удобрения',
    'tools': 'Инструменты',
    'noProducts': 'Товары не найдены',
    'quantity': 'Количество',
    'deliveryAddress': 'Адрес доставки',
    'enterDeliveryAddress': 'Введите адрес',
    'orderNotes': 'Комментарий',
    'orderNotesHint': 'Время доставки или доп. комментарий',
    'confirmPurchase': 'Подтвердить заказ',
    'totalAmount': 'Итого',
    'plantScanner': 'Сканер растений',
    'plantScannerSubtitle': 'Болезни, вредители и дефицит',
    'plantScanHero': 'Отсканируйте растение',
    'plantScanHeroBody': 'Сделайте фото — покажем болезни, вредителей и нехватку питания.',
    'scanWithCamera': 'Сканировать камерой',
    'pickFromGallery': 'Выбрать из галереи',
    'whatWeDetect': 'Что определяем',
    'diseases': 'Болезни',
    'diseasesHint': 'Грибки, бактерии и другие поражения',
    'harmfulAgents': 'Вредители',
    'harmfulAgentsHint': 'Насекомые, вредители и токсичные факторы',
    'deficiencies': 'Нехватка веществ',
    'deficienciesHint': 'Азот, калий, кальций и другие элементы',
    'analyzingPlant': 'Анализируем…',
    'analyzingPlantHint': 'Проверяем листья, цвет и пятна',
    'scanAgain': 'Сканировать снова',
    'healthScore': 'Оценка здоровья',
    'noDiseasesFound': 'Признаков болезни нет',
    'noHarmfulFound': 'Вредители не найдены',
    'noDeficienciesFound': 'Дефицит не найден',
    'careTips': 'Советы по уходу',
    'advice': 'Рекомендация',
    'severityHigh': 'Высокий',
    'severityMedium': 'Средний',
    'severityLow': 'Низкий',
    'getHelpService': 'Вызвать специалиста',
    'shopRemedies': 'Средства в магазине',
    'plantScanDisclaimer': 'Результат — предварительная оценка. Для точного диагноза обратитесь к агроному.',
    'plantScanFailed': 'Не удалось открыть фото. Попробуйте ещё раз.',
    'plantScanWebNote': 'В браузере может потребоваться доступ к камере.',
    'openPlantScanner': 'Проверить растение',
    'orders': 'Заказы',
    'all': 'Все',
    'active': 'Активные',
    'completed': 'Завершённые',
    'cancelled': 'Отменённые',
    'noOrders': 'Нет заказов',
    'orderDetail': 'Детали заказа',
    'orderSuccess': 'Заказ принят',
    'payment': 'Оплата',
    'payNow': 'Оплатить',
    'orderAgain': 'Заказать снова',
    'statusPending': 'Ожидание',
    'statusAccepted': 'Принят',
    'statusInProgress': 'В работе',
    'statusCompleted': 'Завершён',
    'statusCancelled': 'Отменён',
    'messages': 'Сообщения',
    'noMessages': 'Нет сообщений',
    'typeMessage': 'Напишите сообщение…',
    'notifications': 'Уведомления',
    'bookService': 'Оформить заказ',
    'chooseDate': 'Выберите дату',
    'chooseTime': 'Выберите время',
    'areaSize': 'Площадь',
    'measureArea': 'Измерить площадь',
    'next': 'Далее',
    'back': 'Назад',
    'submitOrder': 'Отправить заказ',
    'seasonSpring': 'Весна',
    'seasonSummer': 'Лето',
    'seasonAutumn': 'Осень',
    'seasonWinter': 'Зима',
    'seasonSpringSub': 'Цветы распускаются',
    'seasonSummerSub': 'Фрукты созревают',
    'seasonAutumnSub': 'Листья опадают',
    'seasonWinterSub': 'Сезон отдыха',
    'getStarted': 'Начать',
    'skip': 'Пропустить',
  };

  static const _en = {
    'appName': 'e-makon',
    'navHome': 'Home',
    'navHomeShort': 'Home',
    'navOrders': 'Orders',
    'navOrdersShort': 'Orders',
    'navChat': 'Messages',
    'navChatShort': 'Chat',
    'navProfile': 'Profile',
    'cancel': 'Cancel',
    'save': 'Save',
    'edit': 'Edit',
    'logout': 'Log out',
    'settings': 'Settings',
    'theme': 'Theme',
    'language': 'Language',
    'themeDark': 'Dark',
    'themeLight': 'Light',
    'themeSystem': 'System',
    'appearance': 'Appearance',
    'done': 'Done',
    'retry': 'Retry',
    'loading': 'Loading…',
    'search': 'Search',
    'seeAll': 'See all',
    'user': 'User',
    'points': 'pts',
    'close': 'Close',
    'continue': 'Continue',
    'confirm': 'Confirm',
    'delete': 'Delete',
    'yes': 'Yes',
    'no': 'No',
    'error': 'Error',
    'success': 'Success',
    'profile': 'Profile',
    'profileSaved': 'Profile saved',
    'avatarUpdated': 'Profile photo updated',
    'avatarFailed': 'Could not upload photo',
    'gpsUnavailable': 'GPS permission or service is off',
    'addressDetected': 'Address detected via GPS',
    'favorites': 'Favorites',
    'favoriteServices': 'Favorite services',
    'favoritePartners': 'Favorite partners',
    'noFavorites': 'No favorites yet',
    'activeOrders': 'Active orders',
    'loyalty': 'Points',
    'firstName': 'First name',
    'lastName': 'Last name',
    'company': 'Company',
    'email': 'Email',
    'address': 'Address',
    'detectGps': 'Detect GPS',
    'personalInfo': 'Personal info',
    'livingAddress': 'Home address',
    'login': 'Log in',
    'register': 'Sign up',
    'phone': 'Phone',
    'enterPhone': 'Enter your phone number',
    'sendCode': 'Send code',
    'otpTitle': 'Verification code',
    'otpHint': 'Enter the code from SMS',
    'otpDemoHint': 'SMS not connected — demo code: 123456',
    'verify': 'Verify',
    'wrongCode': 'Incorrect code',
    'alreadyHaveAccount': 'Already have an account?',
    'noAccount': "Don't have an account?",
    'welcomeBack': 'Welcome back',
    'createAccount': 'Create account',
    'homeTitle': 'Home',
    'services': 'Services',
    'partners': 'Partners',
    'offers': 'Offers',
    'nearestOffices': 'Nearby offices',
    'nearestFirms': 'Nearby firms',
    'popularServices': 'Popular services',
    'shop': 'Shop',
    'shopSubtitle': 'Flowers, fertilizers & tools',
    'navShop': 'Shop',
    'navScanner': 'Scan',
    'searchServices': 'Search services',
    'noServices': 'No services found',
    'kmAway': 'km',
    'fromPrice': 'from',
    'buy': 'Buy',
    'flowers': 'Flowers',
    'fertilizers': 'Fertilizers',
    'tools': 'Tools',
    'noProducts': 'No products found',
    'quantity': 'Quantity',
    'deliveryAddress': 'Delivery address',
    'enterDeliveryAddress': 'Enter address',
    'orderNotes': 'Notes',
    'orderNotesHint': 'Delivery time or extra notes',
    'confirmPurchase': 'Confirm order',
    'totalAmount': 'Total',
    'plantScanner': 'Plant scanner',
    'plantScannerSubtitle': 'Disease, pests & deficiencies',
    'plantScanHero': 'Scan your plant',
    'plantScanHeroBody': 'Take a photo — we show diseases, pests and missing nutrients.',
    'scanWithCamera': 'Scan with camera',
    'pickFromGallery': 'Choose from gallery',
    'whatWeDetect': 'What we detect',
    'diseases': 'Diseases',
    'diseasesHint': 'Fungal, bacterial and other leaf/stem issues',
    'harmfulAgents': 'Harmful agents',
    'harmfulAgentsHint': 'Insects, pests and toxic factors',
    'deficiencies': 'Deficiencies',
    'deficienciesHint': 'Nitrogen, potassium, calcium and more',
    'analyzingPlant': 'Analyzing…',
    'analyzingPlantHint': 'Checking leaves, color and spots',
    'scanAgain': 'Scan again',
    'healthScore': 'Health score',
    'noDiseasesFound': 'No disease signs found',
    'noHarmfulFound': 'No harmful agents found',
    'noDeficienciesFound': 'No deficiencies found',
    'careTips': 'Care tips',
    'advice': 'Advice',
    'severityHigh': 'High',
    'severityMedium': 'Medium',
    'severityLow': 'Low',
    'getHelpService': 'Call a specialist',
    'shopRemedies': 'Shop remedies',
    'plantScanDisclaimer': 'Result is a first-pass estimate. See an agronomist for a precise diagnosis.',
    'plantScanFailed': 'Could not open the image. Please try again.',
    'plantScanWebNote': 'The browser may ask for camera permission.',
    'openPlantScanner': 'Check a plant',
    'orders': 'Orders',
    'all': 'All',
    'active': 'Active',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'noOrders': 'No orders yet',
    'orderDetail': 'Order details',
    'orderSuccess': 'Order accepted',
    'payment': 'Payment',
    'payNow': 'Pay now',
    'orderAgain': 'Order again',
    'statusPending': 'Pending',
    'statusAccepted': 'Accepted',
    'statusInProgress': 'In progress',
    'statusCompleted': 'Completed',
    'statusCancelled': 'Cancelled',
    'messages': 'Messages',
    'noMessages': 'No messages',
    'typeMessage': 'Type a message…',
    'notifications': 'Notifications',
    'bookService': 'Book service',
    'chooseDate': 'Choose date',
    'chooseTime': 'Choose time',
    'areaSize': 'Area',
    'measureArea': 'Measure area',
    'next': 'Next',
    'back': 'Back',
    'submitOrder': 'Submit order',
    'seasonSpring': 'Spring',
    'seasonSummer': 'Summer',
    'seasonAutumn': 'Autumn',
    'seasonWinter': 'Winter',
    'seasonSpringSub': 'Flowers are blooming',
    'seasonSummerSub': 'Fruits are ripening',
    'seasonAutumnSub': 'Leaves are falling',
    'seasonWinterSub': 'Rest season',
    'getStarted': 'Get started',
    'skip': 'Skip',
  };
}
