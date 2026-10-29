from .base import *  # noqa: F403

DEBUG = True
OTP_DEBUG_RETURN_CODE = True
# Hozircha SMS yo'q — mobil login uchun istalgan 6 xonali kod o'tadi.
OTP_ACCEPT_ANY_CODE = True
# Lokal demo: Click/Payme bo'lmasa ham buyurtma oqimini sinash.
PAYMENTS_TEST_MODE = env.bool("PAYMENTS_TEST_MODE", default=True)  # noqa: F405
# Dev/test clients share 127.0.0.1; production keeps the base limits.
API_THROTTLE_RATES = {}

# Flutter web dev server har safar tasodifiy portda ochiladi.
CORS_ALLOWED_ORIGIN_REGEXES = [r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"]
