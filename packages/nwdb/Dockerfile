# Use the official Node.js 20 image
FROM node:20

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the source code into the container
COPY src/ ./src/

# Specify the entrypoint for the application
CMD ["node", "src/daemon.js"]
