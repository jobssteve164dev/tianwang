FROM python:3.11-slim@sha256:9534e5a8e315485d4061ed659af0fd78a284c015f9b73661b41d6bab25604534 AS dependencies
WORKDIR /build
COPY requirements.txt ./
RUN python -m venv /opt/venv && sed '/^pytest/d' requirements.txt > runtime-requirements.txt && /opt/venv/bin/pip install --no-cache-dir --no-compile -r runtime-requirements.txt

FROM python:3.11-slim@sha256:9534e5a8e315485d4061ed659af0fd78a284c015f9b73661b41d6bab25604534
ENV PATH="/opt/venv/bin:$PATH" PYTHONPATH=/app PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 AI_DEBUG=false
WORKDIR /app
RUN --mount=type=cache,target=/var/lib/apt/lists --mount=type=cache,target=/var/cache/apt apt-get update && apt-get install -y --no-install-recommends git libgomp1 && useradd --uid 1000 --create-home app
COPY --from=dependencies /opt/venv /opt/venv
COPY --chown=app:app src ./src
COPY --chown=app:app rules ./rules
RUN mkdir -p models logs rules/sigma/custom && chown -R app:app /app
USER app
EXPOSE 8888
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=18 CMD python -c "import json,urllib.request; r=json.load(urllib.request.urlopen('http://127.0.0.1:8888/health')); assert r['status']=='healthy',r"
CMD ["python", "-m", "src.main"]
