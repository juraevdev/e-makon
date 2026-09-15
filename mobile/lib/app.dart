import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'app_router.dart';
import 'core/network/api_client.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/auth_provider.dart';
import 'features/home/catalog_provider.dart';

class EmakonApp extends StatefulWidget {
  const EmakonApp({super.key});

  @override
  State<EmakonApp> createState() => _EmakonAppState();
}

class _EmakonAppState extends State<EmakonApp> {
  late final ApiClient _api = ApiClient();
  late final AuthProvider _auth = AuthProvider(_api);
  late final CatalogProvider _catalog = CatalogProvider(_api);
  late final OrdersProvider _orders = OrdersProvider(_api);
  late final GoRouter _router = createRouter();

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider.value(value: _api),
        ChangeNotifierProvider.value(value: _auth),
        ChangeNotifierProvider.value(value: _catalog),
        ChangeNotifierProvider.value(value: _orders),
      ],
      child: MaterialApp.router(
        title: 'My Garden',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        routerConfig: _router,
        builder: (context, child) {
          SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
          return child ?? const SizedBox.shrink();
        },
      ),
    );
  }
}
