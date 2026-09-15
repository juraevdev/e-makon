from __future__ import annotations

from rest_framework.response import Response


def success_response(data=None, message: str = "OK", status: int = 200) -> Response:
    payload = {"success": True, "message": message, "data": data}
    return Response(payload, status=status)
