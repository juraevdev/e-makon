import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'app_router.dart';
import 'core/network/api_client.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/auth_provider.dart';
import 'features/chat/chat_provider.dart';
import 'features/favorites/favorites_provider.dart';
import 'features/home/catalog_provider.dart';
import 'features/reviews/reviews_provider.dart';

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
  late final MessagesProvider _messages = MessagesProvider();
  late final HomeFeedProvider _feed = HomeFeedProvider();
  late final FavoritesProvider _favorites = FavoritesProvider()..load();
  late final ReviewsProvider _reviews = ReviewsProvider()..load();
  late final ChatProvider _chat = ChatProvider();
  late final GoRouter _router = createRouter();

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider.value(value: _api),
        ChangeNotifierProvider.value(value: _auth),
        ChangeNotifierProvider.value(value: _catalog),
        ChangeNotifierProvider.value(value: _orders),
        ChangeNotifierProvider.value(value: _messages),
        ChangeNotifierProvider.value(value: _feed),
        ChangeNotifierProvider.value(value: _favorites),
        ChangeNotifierProvider.value(value: _reviews),
        ChangeNotifierProvider.value(value: _chat),
      ],
      child: MaterialApp.router(
        title: 'e-makon',
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
