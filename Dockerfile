FROM node:18-alpine

WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create data directory (will be mounted as volume, but ensure it exists)
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Initialize database and start the application
CMD ["sh", "-c", "npm run init-db && npm start"]

