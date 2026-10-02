import 'package:emakon_app/core/utils/area_math.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // Toshkent kengligida ~20 m × 30 m to'rtburchak (600 m²).
  const lat = 41.3111;
  const lng = 69.2797;
  const dLat = 20 / 111320.0;
  final dLng = 30 / (111320.0 * 0.751);

  final rect = [
    const GeoPoint(lat, lng),
    GeoPoint(lat, lng + dLng),
    GeoPoint(lat + dLat, lng + dLng),
    const GeoPoint(lat + dLat, lng),
  ];

  test('rectangle area is ~600 m²', () {
    expect(AreaMath.area(rect), closeTo(600, 6));
  });

  test('area does not depend on walking direction', () {
    expect(AreaMath.area(rect.reversed.toList()), closeTo(AreaMath.area(rect), 0.1));
  });

  test('perimeter is ~100 m', () {
    expect(AreaMath.perimeter(rect), closeTo(100, 1));
  });

  test('less than three points has no area', () {
    expect(AreaMath.area(rect.take(2).toList()), 0);
  });

  test('bearing east is ~90°', () {
    expect(AreaMath.bearing(rect[0], rect[1]), closeTo(90, 1));
    expect(AreaMath.bearing(rect[1], rect[2]), closeTo(0, 1));
  });

  test('crossed corner order is detected and fixed', () {
    final crossed = [rect[0], rect[2], rect[1], rect[3]];
    expect(AreaMath.selfIntersects(rect), isFalse);
    expect(AreaMath.selfIntersects(crossed), isTrue);
    final fixed = AreaMath.orderAroundCenter(crossed);
    expect(AreaMath.selfIntersects(fixed), isFalse);
    expect(AreaMath.area(fixed), closeTo(600, 6));
  });

  test('weighted center ignores an outlier sample', () {
    final samples = [
      const GeoPoint(lat, lng, accuracy: 4),
      const GeoPoint(lat + 0.00001, lng, accuracy: 4),
      const GeoPoint(lat - 0.00001, lng, accuracy: 4),
      const GeoPoint(lat, lng + 0.00001, accuracy: 4),
      const GeoPoint(lat + 0.0003, lng, accuracy: 6),
    ];
    final c = AreaMath.weightedCenter(samples);
    expect(AreaMath.distance(c, const GeoPoint(lat, lng)), lessThan(1.5));
  });

  test('kalman smooths a jump with poor accuracy', () {
    final k = GeoKalman();
    k.process(const GeoPoint(lat, lng, accuracy: 3), 0);
    final p = k.process(const GeoPoint(lat + 0.0002, lng, accuracy: 20), 1000);
    expect(AreaMath.distance(p, const GeoPoint(lat, lng)), lessThan(3));
  });
}
