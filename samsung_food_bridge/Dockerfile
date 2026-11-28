FROM python:3.12-slim-bookworm
ENV PYTHONUNBUFFERED=1 PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
RUN pip install --no-cache-dir playwright==1.56.0 websockets==15.0.1 \
    && python -m playwright install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY bridge.py control.py extract.js extract-shopping.js ./
CMD ["python", "control.py"]
