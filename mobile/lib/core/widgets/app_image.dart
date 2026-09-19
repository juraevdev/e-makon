import 'package:flutter/material.dart';

/// Asset yoki tarmoq rasmini bir xil ko‘rsatadi.
class AppImage extends StatelessWidget {
  const AppImage({
    super.key,
    required this.path,
    this.fit = BoxFit.cover,
    this.fallback,
    this.width,
    this.height,
  });

  final String path;
  final BoxFit fit;
  final Widget? fallback;
  final double? width;
  final double? height;

  static bool isNetwork(String path) =>
      path.startsWith('http://') || path.startsWith('https://');

  @override
  Widget build(BuildContext context) {
    final empty = fallback ?? const ColoredBox(color: Color(0x332E7D32));
    if (path.isEmpty) {
      if (width != null || height != null) {
        return SizedBox(width: width, height: height, child: empty);
      }
      return empty;
    }
    final image = isNetwork(path)
        ? Image.network(
            path,
            width: width,
            height: height,
            fit: fit,
            gaplessPlayback: true,
            errorBuilder: (_, _, _) => empty,
          )
        : Image.asset(
            path,
            width: width,
            height: height,
            fit: fit,
            gaplessPlayback: true,
            errorBuilder: (_, _, _) => empty,
          );
    if (width != null || height != null) return image;
    return SizedBox.expand(child: image);
  }
}
