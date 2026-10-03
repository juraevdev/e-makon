import 'dart:math' as math;

/// Hovli chegarasidagi bitta GPS nuqta.
class GeoPoint {
  const GeoPoint(this.lat, this.lng, {this.accuracy = 0});

  final double lat;
  final double lng;

  /// GPS aniqligi (metr).
  final double accuracy;
}

/// Kichik hududlar (bir necha km gacha) uchun maydon/perimetr hisoblash.
///
/// Nuqtalar birinchi nuqta atrofida tekis (metr) koordinatalarga proyeksiya qilinadi,
/// so'ng ko'pburchak maydoni Gauss (shoelace) formulasi bilan topiladi.
class AreaMath {
  static const double _earthRadius = 6378137.0;

  static double _rad(double deg) => deg * math.pi / 180;

  /// [p] nuqtaning [origin] ga nisbatan metrlardagi o'rni (x — sharq, y — shimol).
  static (double, double) toLocal(GeoPoint origin, GeoPoint p) {
    final cosLat = math.cos(_rad(origin.lat));
    return (_rad(p.lng - origin.lng) * cosLat * _earthRadius, _rad(p.lat - origin.lat) * _earthRadius);
  }

  /// Nuqtalarni birinchi nuqtaga nisbatan metrlarda qaytaradi.
  static List<(double, double)> project(List<GeoPoint> points) {
    if (points.isEmpty) return const [];
    return [for (final p in points) toLocal(points.first, p)];
  }

  /// Ikki nuqta orasidagi masofa (metr, haversine).
  static double distance(GeoPoint a, GeoPoint b) {
    final dLat = _rad(b.lat - a.lat);
    final dLng = _rad(b.lng - a.lng);
    final h =
        math.pow(math.sin(dLat / 2), 2) +
        math.cos(_rad(a.lat)) * math.cos(_rad(b.lat)) * math.pow(math.sin(dLng / 2), 2);
    return 2 * _earthRadius * math.asin(math.min(1, math.sqrt(h)));
  }

  /// [a] dan [b] ga yo'nalish, shimoldan soat mili bo'yicha gradus (0..360).
  static double bearing(GeoPoint a, GeoPoint b) {
    final (x, y) = toLocal(a, b);
    return (math.atan2(x, y) * 180 / math.pi + 360) % 360;
  }

  /// Yopiq ko'pburchak maydoni, m².
  static double area(List<GeoPoint> points) {
    if (points.length < 3) return 0;
    final xy = project(points);
    var sum = 0.0;
    for (var i = 0; i < xy.length; i++) {
      final (x1, y1) = xy[i];
      final (x2, y2) = xy[(i + 1) % xy.length];
      sum += x1 * y2 - x2 * y1;
    }
    return sum.abs() / 2;
  }

  /// Perimetr (metr). [closed] — oxirgi nuqtadan birinchisiga qaytish ham qo'shiladi.
  static double perimeter(List<GeoPoint> points, {bool closed = true}) {
    if (points.length < 2) return 0;
    var sum = 0.0;
    for (var i = 1; i < points.length; i++) {
      sum += distance(points[i - 1], points[i]);
    }
    if (closed && points.length > 2) sum += distance(points.last, points.first);
    return sum;
  }

  /// Maydon xatosi taxmini (m²): perimetr × burchaklarning o'rtacha aniqligi.
  static double errorEstimate(List<GeoPoint> points) {
    if (points.length < 3) return 0;
    final acc = points.fold<double>(0, (s, p) => s + p.accuracy) / points.length;
    return perimeter(points) * acc;
  }

  /// Bir joyda turib olingan bir nechta GPS o'lchovidan aniqroq nuqta.
  ///
  /// O'lchovlar aniqligiga ko'ra (1/acc²) og'irlik bilan o'rtachalanadi;
  /// 4 tadan ko'p bo'lsa, markazdan eng uzoq "sakragan" o'lchov tashlab yuboriladi.
  static GeoPoint weightedCenter(List<GeoPoint> samples) {
    assert(samples.isNotEmpty);
    GeoPoint center(List<GeoPoint> s) {
      var w = 0.0, lat = 0.0, lng = 0.0, acc = 0.0;
      for (final p in s) {
        final wi = 1 / math.pow(math.max(p.accuracy, 1.0), 2);
        w += wi;
        lat += p.lat * wi;
        lng += p.lng * wi;
        acc += p.accuracy;
      }
      return GeoPoint(lat / w, lng / w, accuracy: acc / s.length);
    }

    var c = center(samples);
    if (samples.length > 4) {
      final far = samples.reduce((a, b) => distance(c, a) >= distance(c, b) ? a : b);
      c = center([...samples]..remove(far));
    }
    // GPS xatolari vaqt bo'yicha bog'liq, shuning uchun aniqlik √n marta emas, taxminan 30% yaxshilanadi.
    return GeoPoint(c.lat, c.lng, accuracy: c.accuracy * (samples.length >= 4 ? 0.7 : 0.85));
  }

  /// Ko'pburchak tomonlari bir-birini kesib o'tadimi (masalan, burchaklar aralash tartibda bosilgan).
  static bool selfIntersects(List<GeoPoint> points) {
    final n = points.length;
    if (n < 4) return false;
    final xy = project(points);
    double cross((double, double) o, (double, double) a, (double, double) b) =>
        (a.$1 - o.$1) * (b.$2 - o.$2) - (a.$2 - o.$2) * (b.$1 - o.$1);
    bool hit((double, double) a, (double, double) b, (double, double) c, (double, double) d) {
      final d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
      return ((d1 > 0) != (d2 > 0)) && ((d3 > 0) != (d4 > 0));
    }

    for (var i = 0; i < n; i++) {
      for (var j = i + 2; j < n; j++) {
        if (i == 0 && j == n - 1) continue;
        if (hit(xy[i], xy[(i + 1) % n], xy[j], xy[(j + 1) % n])) return true;
      }
    }
    return false;
  }

  /// Burchaklarni markaz atrofida aylana bo'yicha tartiblaydi (kesishgan shaklni tuzatish uchun).
  static List<GeoPoint> orderAroundCenter(List<GeoPoint> points) {
    if (points.length < 3) return points;
    final xy = project(points);
    final cx = xy.fold<double>(0, (s, p) => s + p.$1) / xy.length;
    final cy = xy.fold<double>(0, (s, p) => s + p.$2) / xy.length;
    final idx = List<int>.generate(points.length, (i) => i)
      ..sort((a, b) => math.atan2(xy[a].$2 - cy, xy[a].$1 - cx).compareTo(math.atan2(xy[b].$2 - cy, xy[b].$1 - cx)));
    final start = idx.indexOf(0);
    return [for (var k = 0; k < idx.length; k++) points[idx[(start + k) % idx.length]]];
  }
}

/// Jonli GPS joylashuvini silliqlash uchun oddiy Kalman filtri.
///
/// Har bir o'lchov o'z aniqligiga ko'ra hisobga olinadi: aniqligi yomon o'lchov
/// joriy holatni kam siljitadi, shu tufayli nuqta "sakramaydi".
class GeoKalman {
  GeoKalman({this.speed = 1.5});

  /// Kutilgan harakat tezligi (m/s) — piyoda yurish uchun 1–2.
  final double speed;

  double _lat = 0, _lng = 0, _variance = -1;
  int _ts = 0;

  bool get ready => _variance >= 0;

  void reset() => _variance = -1;

  GeoPoint process(GeoPoint p, int timestampMs) {
    final acc = math.max(p.accuracy, 1.0);
    if (_variance < 0) {
      _lat = p.lat;
      _lng = p.lng;
      _variance = acc * acc;
      _ts = timestampMs;
    } else {
      final dt = timestampMs - _ts;
      if (dt > 0) {
        _variance += dt * speed * speed / 1000;
        _ts = timestampMs;
      }
      final k = _variance / (_variance + acc * acc);
      _lat += k * (p.lat - _lat);
      _lng += k * (p.lng - _lng);
      _variance = (1 - k) * _variance;
    }
    return GeoPoint(_lat, _lng, accuracy: math.sqrt(_variance));
  }
}
