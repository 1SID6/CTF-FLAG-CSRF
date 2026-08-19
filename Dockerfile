FROM node:18-bullseye-slim

# Install necessary libraries for Puppeteer/Chromium
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && apt-get install -y fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
       libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
       libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 \
       libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
       libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
       libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation \
       libappindicator1 libnss3 lsb-release xdg-utils \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set up work directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source
COPY . .

# Add a non-root user for security and to run Puppeteer
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /usr/src/app

# Run everything after as non-privileged user.
USER pptruser

ENV PORT=3000
EXPOSE 3000

CMD ["node", "app.js"]
