FROM python:3.12-slim-bookworm
RUN pip install --no-cache-dir Pillow==12.0.0 pillow-heif==1.1.1
WORKDIR /app
COPY convert.py .
CMD ["python", "-u", "convert.py"]
