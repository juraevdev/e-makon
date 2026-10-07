import os

from django.core.asgi import get_asgi_application

# Servers default to production; `manage.py runserver` sets local itself.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

application = get_asgi_application()
