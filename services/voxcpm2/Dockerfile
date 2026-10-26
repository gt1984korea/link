FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 git && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .
ENV PORT=8080 HF_HOME=/cache/huggingface VOXCPM2_CACHE_DIR=/cache/audio PYTHONUNBUFFERED=1
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=600s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=3)"
CMD ["python", "server.py"]
