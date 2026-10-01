# ---------- 1) Frontend build ----------
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
COPY backend/requirements.txt backend/requirements-prod.txt ./
RUN pip install -r requirements-prod.txt
COPY backend/ ./
COPY --from=web /src/backend/frontend_build ./frontend_build
RUN useradd -m avtora && mkdir -p media logs backups staticfiles && chown -R avtora /app
USER avtora
ENV PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health/' % os.getenv('PORT','8000'))" || exit 1
# PORT ni platforma beradi (Railway avtomatik o'rnatadi)
CMD ["python", "manage.py", "start"]
