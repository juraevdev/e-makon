from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class AppError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "error"
    default_detail = "Request failed."


class OTPError(AppError):
    default_code = "otp_error"


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    detail = response.data
    if isinstance(detail, dict) and "detail" in detail and len(detail) == 1:
        message = detail["detail"]
        errors = None
    else:
        message = "Validation error"
        errors = detail

    response.data = {
        "success": False,
        "message": str(message),
        "errors": errors,
        "code": getattr(exc, "default_code", getattr(exc, "code", "error")),
    }
    return response
