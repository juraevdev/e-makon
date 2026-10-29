"""
Settings package entry.

Default: local (manage.py / lokal).
Production: DJANGO_SETTINGS_MODULE=config.settings.production
  yoki DJANGO_ENV=production bilan config.settings.
"""

import os

if os.environ.get("DJANGO_ENV", "").strip().lower() in {"production", "prod"}:
    from .production import *  # noqa: F403
else:
    from .local import *  # noqa: F403
