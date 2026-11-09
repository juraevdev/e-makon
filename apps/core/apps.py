from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    label = "core"
    verbose_name = "Core"

    def ready(self) -> None:
        from django.contrib import admin

        from apps.core.admin_access import patch_admin_site

        patch_admin_site(admin.site)
