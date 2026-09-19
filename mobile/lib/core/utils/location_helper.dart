import 'package:geolocator/geolocator.dart';

class LocationResult {
  const LocationResult({
    required this.lat,
    required this.lng,
    required this.label,
  });

  final double lat;
  final double lng;
  final String label;
}

class LocationHelper {
  /// GPS dan hozirgi joylashuvni oladi (ruxsat so‘raydi).
  static Future<LocationResult?> currentAddress() async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      return null;
    }

    final serviceOn = await Geolocator.isLocationServiceEnabled();
    if (!serviceOn) return null;

    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );

    // Offline/demo: reverse geocode o‘rniga taxminiy Toshkent manzili.
    final label =
        'GPS: ${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)} · Toshkent atrofi';
    return LocationResult(lat: pos.latitude, lng: pos.longitude, label: label);
  }
}
