import os

from django.core.wsgi import get_wsgi_application

# Servers (gunicorn) default to production; `manage.py runserver` sets local itself.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

application = get_wsgi_application()
