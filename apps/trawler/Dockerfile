# Use an official Node.js runtime as a parent image, based on Alpine
FROM node:20-alpine

RUN mkdir /app

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /usr/src/app
COPY . .

# RUN echo "registry=http://host.docker.internal:4873" > .npmrc

# Install any needed packages specified in package.json
RUN yarn install  --network-timeout 1000000

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Run the app when the container launches
CMD ["node", "src/daemon.js"]