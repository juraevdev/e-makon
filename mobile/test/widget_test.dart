import 'package:flutter_test/flutter_test.dart';
<<<<<<< HEAD
import 'package:mygarden_app/main.dart';

void main() {
  testWidgets('App launches splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(const MyGardenApp());
    expect(find.text('My Garden'), findsOneWidget);
=======

import 'package:emakon_app/app.dart';

void main() {
  testWidgets('App boots', (tester) async {
    await tester.pumpWidget(const EmakonApp());
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('My Garden'), findsWidgets);
>>>>>>> 63cd8e2c5ad351605a7b5f99b986ce243e9059a8
  });
}
