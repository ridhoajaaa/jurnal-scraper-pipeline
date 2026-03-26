FROM node:20-slim

# Install Python + pip for the processor
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    chromium \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install Node dependencies for scraper
COPY scraper/package*.json ./scraper/
RUN cd scraper && npm install

# Install Node dependencies for web
COPY web/package*.json ./web/
RUN cd web && npm install

# Install Python dependencies
COPY processor/requirements.txt ./processor/
RUN pip3 install --break-system-packages -r processor/requirements.txt

# Copy all source files
COPY scraper/ ./scraper/
COPY processor/ ./processor/
COPY web/ ./web/

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

COPY web/start.sh /app/web/start.sh
RUN chmod +x /app/web/start.sh

CMD ["bash", "/app/web/start.sh"]