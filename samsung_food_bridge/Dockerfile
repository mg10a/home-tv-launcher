FROM python:3.12-bookworm
ENV PYTHONUNBUFFERED=1 PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
RUN pip install --no-cache-dir playwright==1.56.0 && python -m playwright install --with-deps chromium
WORKDIR /app
COPY bridge.py extract.js extract-shopping.js ./
CMD ["python", "bridge.py"]
