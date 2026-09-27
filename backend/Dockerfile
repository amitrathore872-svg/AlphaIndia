FROM python:3.12-slim-bookworm

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies required for compiling C extensions (curl_cffi, lxml, psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    libffi-dev \
    libxml2-dev \
    libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements and spaCy NLP model
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt && \
    python -m spacy download en_core_web_sm

# Copy the entire backend application
COPY . .

# Ensure data storage directories exist
RUN mkdir -p /app/data /app/data/bronze/nse/pdfs

EXPOSE 8000

# Default entrypoint runs the FastAPI application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
