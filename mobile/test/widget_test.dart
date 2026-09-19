import 'package:emakon_app/app.dart';
import 'package:emakon_app/core/widgets/emakon_logo.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('App boots with e-makon branding', (tester) async {
    await tester.pumpWidget(const EmakonApp());
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(EmakonLogo), findsWidgets);
  });
}
