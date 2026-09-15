import 'package:flutter/material.dart';
<<<<<<< HEAD
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'core/theme/app_theme.dart';
import 'providers/app_state.dart';
import 'screens/splash/splash_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF1E1E1E),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const MyGardenApp());
}

class MyGardenApp extends StatelessWidget {
  const MyGardenApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState(),
      child: MaterialApp(
        title: 'My Garden',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        home: const SplashScreen(),
      ),
    );
  }
=======

import 'app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const EmakonApp());
>>>>>>> 63cd8e2c5ad351605a7b5f99b986ce243e9059a8
}
