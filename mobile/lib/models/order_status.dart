enum OrderStatus {
  newOrder,
  inReview,
  contacted,
  completed,
  cancelled;

  String get label {
    switch (this) {
      case OrderStatus.newOrder:
        return 'Yangi';
      case OrderStatus.inReview:
        return 'Kelishilmoqda';
      case OrderStatus.contacted:
        return 'Bog\'lanildi';
      case OrderStatus.completed:
        return 'Bajarildi';
      case OrderStatus.cancelled:
        return 'Bekor qilindi';
    }
  }

  bool get isActive =>
      this == OrderStatus.newOrder ||
      this == OrderStatus.inReview ||
      this == OrderStatus.contacted;

  bool get isCompleted => this == OrderStatus.completed;

  bool get isCancelled => this == OrderStatus.cancelled;

  double get progress {
    switch (this) {
      case OrderStatus.newOrder:
        return 0.22;
      case OrderStatus.inReview:
        return 0.48;
      case OrderStatus.contacted:
        return 0.72;
      case OrderStatus.completed:
      case OrderStatus.cancelled:
        return 1.0;
    }
  }
}
