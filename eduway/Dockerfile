# Railway / Docker uchun. Ilova faqat platforma proksisi orqali ochiladi, shuning uchun X-Forwarded-* sarlavhalariga ishonamiz.
# ---------- 1) Frontend ----------
FROM node:20-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build   # natija: /src/backend/frontend_build

# ---------- 2) Backend ----------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=web /src/backend/frontend_build ./frontend_build
RUN useradd -m eduway && mkdir -p staticfiles && chown -R eduway /app
USER eduway
ENV PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health/' % os.getenv('PORT','8000'))" || exit 1
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_content && python manage.py collectstatic --noinput -v0 && waitress-serve --host=0.0.0.0 --port=${PORT} --threads=8 --trusted-proxy='*' --trusted-proxy-headers='x-forwarded-proto x-forwarded-for' config.wsgi:application"]
