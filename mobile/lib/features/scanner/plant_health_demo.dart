import '../../core/l10n/app_language.dart';

enum PlantIssueKind { disease, toxin, deficiency }

class PlantIssue {
  const PlantIssue({
    required this.kind,
    required this.title,
    required this.detail,
    required this.advice,
    this.severity = 'medium',
  });

  final PlantIssueKind kind;
  final String title;
  final String detail;
  final String advice;
  final String severity; // low | medium | high
}

class PlantScanResult {
  const PlantScanResult({
    required this.plantName,
    required this.healthScore,
    required this.summary,
    required this.diseases,
    required this.toxins,
    required this.deficiencies,
    required this.tips,
    this.relatedServiceSlug = 'pest-control',
    this.emoji = '🌿',
  });

  final String plantName;
  final int healthScore;
  final String summary;
  final List<PlantIssue> diseases;
  final List<PlantIssue> toxins;
  final List<PlantIssue> deficiencies;
  final List<String> tips;
  final String relatedServiceSlug;
  final String emoji;
}

/// Demo AI tahlil — keyinchalik haqiqiy model/API bilan almashtiriladi.
class PlantHealthDemo {
  static PlantScanResult analyze({required int seed, AppLanguage lang = AppLanguage.uzLatn}) {
    final profiles = _profiles(lang);
    return profiles[seed.abs() % profiles.length];
  }

  static List<PlantScanResult> _profiles(AppLanguage lang) {
    final uz = lang == AppLanguage.uzLatn || lang == AppLanguage.uzCyrl;
    final ru = lang == AppLanguage.ru;
    // en otherwise

    if (ru) {
      return const [
        PlantScanResult(
          plantName: 'Роза (Rosa)',
          emoji: '🌹',
          healthScore: 62,
          summary: 'Листья повреждены, есть признаки грибка и нехватки питания.',
          diseases: [
            PlantIssue(
              kind: PlantIssueKind.disease,
              title: 'Чёрная пятнистость',
              detail: 'Тёмные пятна на листьях, края желтеют.',
              advice: 'Удалите поражённые листья, обработайте фунгицидом.',
              severity: 'high',
            ),
            PlantIssue(
              kind: PlantIssueKind.disease,
              title: 'Мучнистая роса (ранняя)',
              detail: 'Белый налёт на молодых побегах.',
              advice: 'Улучшите проветривание, опрыскайте серой.',
              severity: 'medium',
            ),
          ],
          toxins: [
            PlantIssue(
              kind: PlantIssueKind.toxin,
              title: 'Тля',
              detail: 'Мелкие вредители на нижней стороне листьев.',
              advice: 'Промойте мыльным раствором или используйте биоинсектицид.',
              severity: 'medium',
            ),
          ],
          deficiencies: [
            PlantIssue(
              kind: PlantIssueKind.deficiency,
              title: 'Нехватка азота (N)',
              detail: 'Бледные нижние листья, слабый рост.',
              advice: 'Внесите азотное или комплексное NPK удобрение.',
              severity: 'medium',
            ),
            PlantIssue(
              kind: PlantIssueKind.deficiency,
              title: 'Нехватка калия (K)',
              detail: 'Края листьев подсыхают.',
              advice: 'Добавьте калийные подкормки.',
              severity: 'low',
            ),
          ],
          tips: [
            'Поливайте под корень, не по листьям.',
            'Утром осматривайте нижнюю сторону листьев.',
            'Мульча поможет сохранить влагу.',
          ],
          relatedServiceSlug: 'pest-control',
        ),
        PlantScanResult(
          plantName: 'Томат',
          emoji: '🍅',
          healthScore: 48,
          summary: 'Есть признаки фитофтороза и дефицита кальция.',
          diseases: [
            PlantIssue(
              kind: PlantIssueKind.disease,
              title: 'Фитофтороз',
              detail: 'Бурые пятна на листьях и стеблях.',
              advice: 'Уберите больные части, обработайте медьсодержащим препаратом.',
              severity: 'high',
            ),
          ],
          toxins: [
            PlantIssue(
              kind: PlantIssueKind.toxin,
              title: 'Белокрылка',
              detail: 'Мелкие белые насекомые при встряхивании листьев.',
              advice: 'Жёлтые ловушки и системный инсектицид.',
              severity: 'medium',
            ),
          ],
          deficiencies: [
            PlantIssue(
              kind: PlantIssueKind.deficiency,
              title: 'Нехватка кальция (Ca)',
              detail: 'Вершинная гниль плодов, деформация листьев.',
              advice: 'Кальциевая селитра + равномерный полив.',
              severity: 'high',
            ),
            PlantIssue(
              kind: PlantIssueKind.deficiency,
              title: 'Нехватка магния (Mg)',
              detail: 'Межжилковый хлороз на старых листьях.',
              advice: 'Сульфат магния (эпизодически).',
              severity: 'low',
            ),
          ],
          tips: [
            'Не загущайте посадки.',
            'Полив утром, почва без пересыхания.',
            'Мульчируйте междурядья.',
          ],
          relatedServiceSlug: 'fertilize',
        ),
        PlantScanResult(
          plantName: 'Комнатный фикус',
          emoji: '🪴',
          healthScore: 78,
          summary: 'В целом здоров, лёгкий стресс от полива и света.',
          diseases: [
            PlantIssue(
              kind: PlantIssueKind.disease,
              title: 'Корневая гниль (риск)',
              detail: 'Почва долго остаётся влажной.',
              advice: 'Сократите полив, проверьте дренаж.',
              severity: 'low',
            ),
          ],
          toxins: [],
          deficiencies: [
            PlantIssue(
              kind: PlantIssueKind.deficiency,
              title: 'Нехватка железа (Fe)',
              detail: 'Молодые листья светлее обычного.',
              advice: 'Хелатное железо по инструкции.',
              severity: 'low',
            ),
          ],
          tips: [
            'Держите у яркого рассеянного света.',
            'Не ставьте на холодный сквозняк.',
            'Раз в месяц мягко протирайте листья.',
          ],
          relatedServiceSlug: 'free-consult',
        ),
      ];
    }

    if (!uz && !ru) {
      // English
      return const [
        PlantScanResult(
          plantName: 'Rose (Rosa)',
          emoji: '🌹',
          healthScore: 62,
          summary: 'Leaves show fungal spots and nutrient stress.',
          diseases: [
            PlantIssue(
              kind: PlantIssueKind.disease,
              title: 'Black spot',
              detail: 'Dark spots on leaves; edges turning yellow.',
              advice: 'Remove affected leaves; apply a fungicide.',
              severity: 'high',
            ),
            PlantIssue(
              kind: PlantIssueKind.disease,
              title: 'Powdery mildew (early)',
              detail: 'White film on young shoots.',
              advice: 'Improve airflow; spray with sulfur if needed.',
              severity: 'medium',
            ),
          ],
          toxins: [
            PlantIssue(
              kind: PlantIssueKind.toxin,
              title: 'Aphids',
              detail: 'Tiny pests under leaves.',
              advice: 'Wash with mild soap or use a bio-insecticide.',
              severity: 'medium',
            ),
          ],
          deficiencies: [
            PlantIssue(
              kind: PlantIssueKind.deficiency,
              title: 'Nitrogen (N) deficiency',
              detail: 'Pale lower leaves, weak growth.',
              advice: 'Apply nitrogen or balanced NPK fertilizer.',
              severity: 'medium',
            ),
            PlantIssue(
              kind: PlantIssueKind.deficiency,
              title: 'Potassium (K) deficiency',
              detail: 'Leaf margins drying.',
              advice: 'Add a potassium feed.',
              severity: 'low',
            ),
          ],
          tips: [
            'Water at the base, not on leaves.',
            'Check leaf undersides in the morning.',
            'Mulch to keep soil moisture steady.',
          ],
        ),
        PlantScanResult(
          plantName: 'Tomato',
          emoji: '🍅',
          healthScore: 48,
          summary: 'Late blight signs and calcium deficiency detected.',
          diseases: [
            PlantIssue(
              kind: PlantIssueKind.disease,
              title: 'Late blight',
              detail: 'Brown lesions on leaves and stems.',
              advice: 'Remove infected parts; copper spray.',
              severity: 'high',
            ),
          ],
          toxins: [
            PlantIssue(
              kind: PlantIssueKind.toxin,
              title: 'Whitefly',
              detail: 'Tiny white insects when leaves are shaken.',
              advice: 'Yellow sticky traps + systemic insecticide.',
              severity: 'medium',
            ),
          ],
          deficiencies: [
            PlantIssue(
              kind: PlantIssueKind.deficiency,
              title: 'Calcium (Ca) deficiency',
              detail: 'Blossom-end rot risk, leaf distortion.',
              advice: 'Calcium nitrate + even watering.',
              severity: 'high',
            ),
          ],
          tips: [
            'Avoid overcrowding plants.',
            'Water in the morning.',
            'Mulch between rows.',
          ],
          relatedServiceSlug: 'fertilize',
        ),
        PlantScanResult(
          plantName: 'Indoor ficus',
          emoji: '🪴',
          healthScore: 78,
          summary: 'Mostly healthy with mild watering/light stress.',
          diseases: [
            PlantIssue(
              kind: PlantIssueKind.disease,
              title: 'Root rot risk',
              detail: 'Soil stays wet too long.',
              advice: 'Water less; check drainage holes.',
              severity: 'low',
            ),
          ],
          toxins: [],
          deficiencies: [
            PlantIssue(
              kind: PlantIssueKind.deficiency,
              title: 'Iron (Fe) deficiency',
              detail: 'Young leaves slightly pale.',
              advice: 'Use chelated iron as directed.',
              severity: 'low',
            ),
          ],
          tips: [
            'Bright indirect light.',
            'Avoid cold drafts.',
            'Wipe leaves monthly.',
          ],
          relatedServiceSlug: 'free-consult',
        ),
      ];
    }

    // Uzbek (Latin + Cyrillic share Latin demo text for clarity)
    return const [
      PlantScanResult(
        plantName: 'Atirgul (Rosa)',
        emoji: '🌹',
        healthScore: 62,
        summary: 'Barglarda dog‘ va ozuqa yetishmovchiligi belgilari aniqlandi.',
        diseases: [
          PlantIssue(
            kind: PlantIssueKind.disease,
            title: 'Qora dog‘ kasalligi',
            detail: 'Barglarda qora dog‘lar, chetlari sarg‘aygan.',
            advice: 'Zararlangan barglarni olib tashlang, fungitsid seping.',
            severity: 'high',
          ),
          PlantIssue(
            kind: PlantIssueKind.disease,
            title: 'Un-simo kasallik (erta bosqich)',
            detail: 'Yosh novdalarda oq kukunsimon qatlam.',
            advice: 'Havoni yaxshilang, kerak bo‘lsa oltingugurt preparati.',
            severity: 'medium',
          ),
        ],
        toxins: [
          PlantIssue(
            kind: PlantIssueKind.toxin,
            title: 'Shira (bitlar)',
            detail: 'Bargning pastki qismida mayda zararli hasharotlar.',
            advice: 'Sovuq sovunli suv bilan yuving yoki bioinsektitsid ishlating.',
            severity: 'medium',
          ),
        ],
        deficiencies: [
          PlantIssue(
            kind: PlantIssueKind.deficiency,
            title: 'Azot (N) yetishmasligi',
            detail: 'Pastki barglar oqarib, o‘sish sekinlashgan.',
            advice: 'Azotli yoki kompleks NPK o‘g‘it bering.',
            severity: 'medium',
          ),
          PlantIssue(
            kind: PlantIssueKind.deficiency,
            title: 'Kaliy (K) yetishmasligi',
            detail: 'Barg chetlari qurib bormoqda.',
            advice: 'Kaliyli oziqlantirish qo‘shing.',
            severity: 'low',
          ),
        ],
        tips: [
          'Suvni bargga emas, ildiz atrofiga quying.',
          'Ertalab bargning pastini tekshiring.',
          'Mulcha namlikni saqlashga yordam beradi.',
        ],
        relatedServiceSlug: 'pest-control',
      ),
      PlantScanResult(
        plantName: 'Pomidor',
        emoji: '🍅',
        healthScore: 48,
        summary: 'Fitoftora belgilari va kalsiy yetishmovchiligi aniqlandi.',
        diseases: [
          PlantIssue(
            kind: PlantIssueKind.disease,
            title: 'Fitoftora',
            detail: 'Barg va poyalarda jigarrang dog‘lar.',
            advice: 'Kasallangan qismlarni olib tashlang, misli preparat seping.',
            severity: 'high',
          ),
        ],
        toxins: [
          PlantIssue(
            kind: PlantIssueKind.toxin,
            title: 'Oq qanot',
            detail: 'Barg silkitilganda oq hasharotlar uchadi.',
            advice: 'Sariq yopishtiruvchi tutqich + tizimli insektitsid.',
            severity: 'medium',
          ),
        ],
        deficiencies: [
          PlantIssue(
            kind: PlantIssueKind.deficiency,
            title: 'Kalsiy (Ca) yetishmasligi',
            detail: 'Meva uchining chirishi xavfi, barg shakli buzilgan.',
            advice: 'Kalsiyli selitra + barqaror sug‘orish.',
            severity: 'high',
          ),
          PlantIssue(
            kind: PlantIssueKind.deficiency,
            title: 'Magniy (Mg) yetishmasligi',
            detail: 'Eski barglarda tomirlar orasi sarg‘aygan.',
            advice: 'Magniy sulfat (dozaga rioya qilib).',
            severity: 'low',
          ),
        ],
        tips: [
          'O‘simliklarni zich ekmang.',
          'Sug‘orishni ertalab qiling.',
          'Qatorlar orasiga mulcha soling.',
        ],
        relatedServiceSlug: 'fertilize',
      ),
      PlantScanResult(
        plantName: 'Xona fikusi',
        emoji: '🪴',
        healthScore: 78,
        summary: 'Umuman yaxshi holatda, engil namlik/yorug‘lik stressi bor.',
        diseases: [
          PlantIssue(
            kind: PlantIssueKind.disease,
            title: 'Ildiz chirishi xavfi',
            detail: 'Tuproq uzoq vaqt nam qolmoqda.',
            advice: 'Sug‘orishni kamaytiring, drenajni tekshiring.',
            severity: 'low',
          ),
        ],
        toxins: [],
        deficiencies: [
          PlantIssue(
            kind: PlantIssueKind.deficiency,
            title: 'Temir (Fe) yetishmasligi',
            detail: 'Yosh barglar biroz oqargan.',
            advice: 'Xelat temir preparatidan foydalaning.',
            severity: 'low',
          ),
        ],
        tips: [
          'Yorug‘, ammo to‘g‘ridan-to‘g‘ri quyoshsiz joy.',
          'Sovuq shamoldan saqlang.',
          'Oyiga bir marta barglarni artib turing.',
        ],
        relatedServiceSlug: 'free-consult',
      ),
    ];
  }
}
