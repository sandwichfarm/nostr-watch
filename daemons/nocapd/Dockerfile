# Use an official Node.js runtime as a parent image, based on Alpine
FROM node:20-alpine
RUN mkdir /app
WORKDIR /app
COPY . .
RUN yarn install
CMD UV_THREADPOOL_SIZE=64 node src/index.js