import 'order_status.dart';

class GardenOrder {
  GardenOrder({
    required this.id,
    required this.serviceId,
    required this.serviceName,
    required this.address,
    required this.area,
    required this.customerName,
    required this.phone,
    this.notes,
    this.photoPath,
    this.status = OrderStatus.newOrder,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  final String id;
  final String serviceId;
  final String serviceName;
  final String address;
  final String area;
  final String customerName;
  String phone;
  final String? notes;
  final String? photoPath;
  OrderStatus status;
  final DateTime createdAt;
}
