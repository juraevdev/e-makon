import '../network/models.dart';

/// Maydon (m²) bo‘yicha taxminiy narx.
class PriceCalculator {
  /// Bazaviy min narx + har 10 m² uchun qo‘shimcha.
  static int estimateForService(ServiceModel service, double areaM2) {
    if (service.priceMin <= 0 && service.priceMax <= 0) return 0;
    final base = service.priceMin;
    if (areaM2 <= 0) return base;
    final blocks = (areaM2 / 10).ceil().clamp(1, 500);
    final perBlock = (service.priceMax > service.priceMin
            ? (service.priceMax - service.priceMin) / 40
            : service.priceMin * 0.04)
        .round()
        .clamp(5000, 500000);
    final total = base + (blocks - 1) * perBlock;
    if (service.priceMax > 0) return total.clamp(base, service.priceMax);
    return total;
  }

  static int estimateCart(List<ServiceModel> services, double areaM2) {
    return services.fold(0, (s, e) => s + estimateForService(e, areaM2));
  }

  static String label(int amount) {
    if (amount <= 0) return 'Bepul / kelishuv';
    return '${ServiceModel.formatMoney(amount)} so‘m';
  }
}
