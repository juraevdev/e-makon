from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import BasePermission

from apps.accounts.models import User


def health(_request):
    return JsonResponse({"status": "ok", "service": "e-makon"})


class SchemaDocsPermission(BasePermission):
    """
    Local/dev: ochiq. Production (DEBUG=False): faqat superadmin.
    Import-time settings.DEBUG o'rniga so'rov vaqtida tekshiriladi
    (Django test runner DEBUG ni False qiladi).
    """

    def has_permission(self, request, view):
        if settings.DEBUG:
            return True
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", None) == User.Role.SUPERADMIN
        )


class SchemaView(SpectacularAPIView):
    permission_classes = [SchemaDocsPermission]


class SwaggerView(SpectacularSwaggerView):
    permission_classes = [SchemaDocsPermission]


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("health/", health),
    path("api/schema/", SchemaView.as_view(), name="schema"),
    path("api/docs/", SwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/", include("config.api_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = "E-Makon / My Garden"
admin.site.site_title = "E-Makon Admin"
admin.site.index_title = "Boshqaruv paneli"
