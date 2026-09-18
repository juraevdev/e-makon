FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

# Default: API. Override command for bot.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
