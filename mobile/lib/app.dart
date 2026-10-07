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
import 'features/loyalty/loyalty_provider.dart';
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
  late final ReviewsProvider _reviews = ReviewsProvider(_api);
  late final ChatProvider _chat = ChatProvider(_api);
  late final LoyaltyProvider _loyalty = LoyaltyProvider(_api, _auth);
  late final GoRouter _router = createRouter();
  late final AppLifecycleListener _lifecycle;
  bool _wasLoggedIn = false;
  int? _userId;

  @override
  void initState() {
    super.initState();
    _api.onSessionExpired = () {
      if (!_auth.isLoggedIn) return;
      _auth.sessionExpired();
      _router.go('/login');
    };
    _auth.addListener(_onAuthChanged);
    // Firma buyurtmani bajarganda server ball beradi — balansni darhol yangilaymiz.
    _orders.onStatusChanged = (order) {
      if (order.isCompleted) {
        _auth.refreshMe();
        _loyalty.load(silent: true);
      }
    };
    _lifecycle = AppLifecycleListener(onResume: _onResume);
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    _auth.removeListener(_onAuthChanged);
    super.dispose();
  }

  void _onAuthChanged() {
    // Chiqish yoki sessiya tugashida oldingi foydalanuvchining buyurtma/suhbatlari qolmasin.
    final now = _auth.isLoggedIn;
    if (_wasLoggedIn && !now) {
      _orders.reset();
      _chat.reset();
    }
    _wasLoggedIn = now;

    final id = _auth.user?.id;
    if (id == _userId) return;
    _userId = id;
    if (id == null) {
      _loyalty.reset();
    } else if (!_auth.bootstrapping) {
      _loyalty.load(silent: true);
    }
  }

  /// Ilova qayta ochilganda superadmin/firma o'zgartirgan ma'lumotlar (katalog, bannerlar, ballar) yangilanadi.
  void _onResume() {
    _catalog.load(silent: true);
    _feed.load(_api, silent: true, withLocation: false);
    if (!_auth.isLoggedIn) return;
    _auth.refreshMe();
    _loyalty.load(silent: true);
    _messages.load(_api, silent: true);
    _chat.loadRooms(silent: true);
  }

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
        ChangeNotifierProvider.value(value: _loyalty),
      ],
      child: MaterialApp.router(
        title: 'e-makon',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        routerConfig: _router,
        builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
          value: AppTheme.systemOverlay,
          child: child ?? const SizedBox.shrink(),
        ),
      ),
    );
  }
}
