from .base import *  # noqa: F403
from .base import env

DEBUG = False
OTP_DEBUG_RETURN_CODE = False
# Customers can self-confirm "test" payments when enabled; production must opt in explicitly.
PAYMENTS_TEST_MODE = env.bool("PAYMENTS_TEST_MODE", default=False)

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
