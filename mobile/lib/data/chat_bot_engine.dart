import '../data/services_data.dart';
import '../models/service.dart';

class ChatBotReply {
  const ChatBotReply({required this.text, this.quickReplies});

  final String text;
  final List<String>? quickReplies;
}

class ChatBotEngine {
  ChatBotEngine._();

  static String greeting({String? firstName}) {
    if (firstName != null && firstName.trim().isNotEmpty) {
      return 'Assalomu alaykum, ${firstName.trim()}! 🌿\n\n'
          'Men Gulnora — My Garden jamoasidanman. '
          'Bugun bog\'ingiz yoki hovlingiz haqida gaplashsak bo\'ladimi? '
          'Xohlasangiz, xizmat tanlashda yoki so\'rov yuborishda yordam beraman. '
          'Savollaringiz bo\'lsa, bemalol yozing — men shu yerdaman! 😊';
    }
    return 'Assalomu alaykum, aziz mehmon! 🌿\n\n'
        'Men Gulnora — My Garden yordamchisiman. '
        'Bog\'ingiz go\'zalligi bizning ishimiz, shuning uchun sizga eng qulay yechimni topishga harakat qilaman.\n\n'
        'Nima haqida gaplashamiz? Xizmat tanlash, narx yoki to\'g\'ridan-to\'g\'ri so\'rov yuborish — '
        'hammasida yoningizdaman!';
  }

  static const greetingQuickReplies = [
    'Bog\'im uchun maslahat kerak',
    'Xizmatlar haqida',
    'So\'rov yubormoqchiman',
    'Narxlar qanday?',
  ];

  static ChatBotReply respond(String userText, {String? firstName}) {
    final lower = userText.toLowerCase().trim();

    if (_isGreeting(lower)) {
      return ChatBotReply(
        text: firstName != null && firstName.isNotEmpty
            ? 'Va alaykum assalom, $firstName! 😊 Qalaysiz? '
                'Bugun bog\'ingiz uchun nima qila olamiz?'
            : 'Va alaykum assalom! 😊 Xush kelibsiz! '
                'Bugun sizga qanday yordam bera olaman?',
        quickReplies: greetingQuickReplies,
      );
    }

    if (_matches(lower, ['rahmat', 'tashakkur', 'sag\'', 'raxmat'])) {
      return ChatBotReply(
        text: 'Arziydi! 💚 Sizga yordam berganimdan xursandman. '
            'Yana savolingiz bo\'lsa, bemalol yozing — men doim shu yerdaman.',
        quickReplies: const ['Yana savolim bor', 'So\'rov yuborish'],
      );
    }

    if (_matches(lower, ['salom', 'assalom', 'hello', 'hi'])) {
      return ChatBotReply(
        text: firstName != null && firstName.isNotEmpty
            ? 'Salom, $firstName! 🌱 Yaxshi kuningiz bo\'lyaptimi? '
                'Bog\'ingiz haqida gaplashsakmi?'
            : 'Salom! 🌱 Juda xursandman, yozganingiz uchun. '
                'Qanday yordam bera olaman?',
        quickReplies: greetingQuickReplies,
      );
    }

    if (_matches(lower, ['so\'rov', 'buyurtma', 'bron', 'yubor'])) {
      return ChatBotReply(
        text: 'Zo\'r qaror! 👍\n\n'
            'So\'rov yuborish juda oson — 4 ta qadamda tugaydi: '
            'xizmat tanlaysiz, manzil yozasiz, aloqa ma\'lumotlari va tasdiqlash. '
            'Yuborganingizdan keyin mutaxassislarimiz tez orada siz bilan bog\'lanadi.\n\n'
            'Hoziroq boshlaymizmi?',
        quickReplies: const ['Ha, boshlaymiz!', 'Avval maslahat olish'],
      );
    }

    if (_matches(lower, ['narx', 'qancha', 'pul', 'arzon', 'qimmat', 'to\'lov'])) {
      return ChatBotReply(
        text: 'Tushunarli savol! 💬\n\n'
            'Narxlar xizmat turiga va maydonga qarab farq qiladi — '
            'har bir bog\' o\'ziga xos kuyligida. Shuning uchun aniq narxni '
            'mutaxassisimiz telefon orqali aytadi, bepul maslahat ham beradi.\n\n'
            'Xohlasangiz, hozir so\'rov qoldiring — sizga qulay vaqtda qo\'ng\'iroq qilamiz. '
            'Hech qanday majburiyat yo\'q, faqat maslahat ham olishingiz mumkin!',
        quickReplies: const ['So\'rov yuborish', 'Xizmatlar ro\'yxati'],
      );
    }

    if (_matches(lower, ['qanday', 'ishlaydi', 'jarayon', 'bosqich'])) {
      return ChatBotReply(
        text: 'Juda sodda! ✨\n\n'
            '1️⃣ Xizmat tanlaysiz\n'
            '2️⃣ Manzil va maydonni yozasiz\n'
            '3️⃣ Telefon raqamingizni qoldirasiz\n'
            '4️⃣ Biz sizga qo\'ng\'iroq qilib, barcha tafsilotlarni aniqlashtiramiz\n\n'
            'Hammasi bir necha daqiqada. Siz faqat xohishingizni ayting — qolganini biz hal qilamiz!',
        quickReplies: const ['So\'rov yuborish', 'Xizmatlar haqida'],
      );
    }

    if (_matches(lower, ['vaqt', 'qachon', 'tez', 'qancha kut'])) {
      return ChatBotReply(
        text: 'So\'rovingizni olish bilan birga jamoamizga yetkazamiz! ⏰\n\n'
            'Odatda bir ish kuni ichida mutaxassisimiz siz bilan bog\'lanadi. '
            'Shoshilinch bo\'lsa, so\'rovda izoh qoldiring — tezroq qarab chiqamiz.',
        quickReplies: const ['So\'rov yuborish'],
      );
    }

    if (_matches(lower, ['telefon', 'qo\'ng\'iroq', 'bog\'lan', 'aloqa'])) {
      return ChatBotReply(
        text: 'Albatta, bog\'lanamiz! 📞\n\n'
            'So\'rov qoldirsangiz, mutaxassisimiz sizga qo\'ng\'iroq qiladi. '
            'Telefon raqamingiz xavfsiz saqlanadi va faqat xizmat ko\'rsatish uchun ishlatiladi.',
        quickReplies: const ['So\'rov yuborish'],
      );
    }

    if (_matches(lower, ['maslahat', 'yordam', 'maslahat', 'nima qil', 'tavsiya'])) {
      return ChatBotReply(
        text: 'Albatta, maslahat beraman! 🌿\n\n'
            'Bog\'ingiz qanday holatda? Masalan:\n'
            '• Yangi bog\' barpo etmoqchimisiz?\n'
            '• Mavjud bog\'ni tartibga keltirmoqchimisiz?\n'
            '• Sug\'orish yoki landshaft kerakmi?\n\n'
            'Qisqacha yozing — sizga eng mos xizmatni tavsiya qilaman.',
        quickReplies: kServices.take(4).map((s) => s.name).toList(),
      );
    }

    if (_matches(lower, ['xizmat', 'ro\'yxat', 'nimalar', 'bor'])) {
      final names = kServices.map((s) => '• ${s.name}').join('\n');
      return ChatBotReply(
        text: 'Bizda 9 ta xizmat bor — har biri sizning bog\'ingiz uchun! 🌸\n\n'
            '$names\n\n'
            'Qaysi biri ko\'proq qiziqtirdi? Ayting, batafsil tushuntirib beraman.',
        quickReplies: kServices.take(4).map((s) => s.name).toList(),
      );
    }

    if (_matches(lower, ['yomon', 'muammo', 'chiroyli emas', 'qurib', 'qurigan', 'kasal'])) {
      return ChatBotReply(
        text: 'Tushundim, xavotir olmang — yordam beramiz! 🤝\n\n'
            'Bog\' har qanday holatdan chiroyli ko\'rinishga keltiriladi. '
            'Mutaxassislarimiz avval holatni baholaydi, keyin eng maqbul yechimni taklif qiladi.\n\n'
            'Xohlasangiz, hozir so\'rov qoldiring — bepul maslahat olishingiz mumkin.',
        quickReplies: const ['So\'rov yuborish', 'Konsultatsiya'],
      );
    }

    final service = _matchService(lower);
    if (service != null) {
      return ChatBotReply(
        text: '${service.name} — zo\'r tanlov! 🌟\n\n'
            '${service.description}\n\n'
            'Bu xizmat ko\'p mijozlarimizga yoqadi. '
            'Xohlasangiz, hoziroq so\'rov qoldirasiz — mutaxassisimiz '
            'sizga qulay vaqtda qo\'ng\'iroq qilib, barchasini tushuntiradi.',
        quickReplies: ['Ha, $service.name', 'Boshqa xizmat ko\'rsat'],
      );
    }

    if (_matches(lower, ['ha,', 'boshlaymiz', 'ha '])) {
      return ChatBotReply(
        text: 'Ajoyib! 🎉 Juda to\'g\'ri qildingiz.\n\n'
            'Hozir so\'rov formasini ochaman — bir necha daqiqada tugatishingiz mumkin. '
            'Savol bo\'lsa, yana yozing!',
        quickReplies: const ['So\'rov yuborish'],
      );
    }

    return ChatBotReply(
      text: firstName != null && firstName.isNotEmpty
          ? '$firstName, yozganingizni o\'qidim! 💚\n\n'
              'Aniqroq tushunishim uchun quyidagilardan birini tanlang '
              'yoki o\'zingiz yozing — men siz bilan samimiy gaplashishga tayyorman:'
          : 'Yozganingizni o\'qidim, rahmat! 💚\n\n'
              'Sizga yordam berish uchun shu yerdaman. '
              'Quyidagilardan birini tanlang yoki erkin yozing:',
      quickReplies: greetingQuickReplies,
    );
  }

  static bool _isGreeting(String lower) {
    return _matches(lower, [
      'assalomu alaykum',
      'va alaykum',
      'salom alaykum',
    ]);
  }

  static bool _matches(String lower, List<String> keywords) {
    return keywords.any(lower.contains);
  }

  static GardenService? _matchService(String lower) {
    for (final s in kServices) {
      final words = s.name.toLowerCase().split(RegExp(r"[\s']+"));
      if (words.any((w) => w.length > 3 && lower.contains(w))) {
        return s;
      }
      if (lower.contains(s.id.replaceAll('_', ' '))) return s;
    }
    return null;
  }

  static bool shouldOpenOrder(String reply) {
    final lower = reply.toLowerCase();
    return lower.contains('so\'rov yubor') ||
        lower.contains('boshlaymiz') ||
        lower.startsWith('ha,');
  }

  static GardenService? serviceFromQuickReply(String reply) {
    if (reply.startsWith('Ha, ')) {
      final name = reply.substring(4);
      try {
        return kServices.firstWhere((s) => s.name == name);
      } catch (_) {}
    }
    try {
      return kServices.firstWhere((s) => s.name == reply);
    } catch (_) {
      return null;
    }
  }
}
