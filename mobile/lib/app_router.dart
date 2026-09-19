import 'package:go_router/go_router.dart';

import '../core/network/models.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/otp_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/chat/chat_screen.dart';
import '../features/home/home_screen.dart';
import '../features/home/service_detail_screen.dart';
import '../features/messages/messages_screen.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/onboarding/splash_screen.dart';
import '../features/orders/order_detail_screen.dart';
import '../features/orders/order_flow_screen.dart';
import '../features/orders/order_success_screen.dart';
import '../features/orders/orders_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/shell/main_shell.dart';

GoRouter createRouter() {
  return GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),
      GoRoute(path: '/onboarding', builder: (context, state) => const OnboardingScreen()),
      GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/otp',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return OtpScreen(
            phoneDigits: extra['phone'] as String? ?? '',
            debugCode: extra['debug_code'] as String?,
          );
        },
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => MainShell(navigationShell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/orders', builder: (context, state) => const OrdersScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/messages', builder: (context, state) => const MessagesScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/profile', builder: (context, state) => const ProfileScreen()),
          ]),
        ],
      ),
      GoRoute(
        path: '/service/:slug',
        builder: (context, state) => ServiceDetailScreen(slug: state.pathParameters['slug']!),
      ),
      GoRoute(
        path: '/order',
        builder: (context, state) {
          final service = state.extra as ServiceModel;
          return OrderFlowScreen(service: service);
        },
      ),
      GoRoute(
        path: '/order-success',
        builder: (context, state) => OrderSuccessScreen(order: state.extra as OrderModel),
      ),
      GoRoute(
        path: '/order-detail',
        builder: (context, state) => OrderDetailScreen(order: state.extra as OrderModel),
      ),
      GoRoute(
        path: '/chat',
        builder: (context, state) => ChatScreen(partner: state.extra as PartnerModel),
      ),
    ],
  );
}
