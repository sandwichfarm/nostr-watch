# Use an official Node.js runtime as a parent image, based on Alpine
FROM node:14-alpine

RUN mkdir /app

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /usr/src/app
COPY . .

# Install any needed packages specified in package.json
RUN yarn install

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Run the app when the container launches
CMD ["node", "src/daemon.js"]