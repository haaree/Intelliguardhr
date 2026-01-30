# Use Node.js 22 Alpine for smaller image size
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production=false

# Copy all files
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3006

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
