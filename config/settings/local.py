from .base import *  # noqa: F403

DEBUG = True
OTP_DEBUG_RETURN_CODE = True
# Dev/test clients share 127.0.0.1; production keeps the base limits.
API_THROTTLE_RATES = {}
