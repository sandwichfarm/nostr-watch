FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip g++ make
RUN mkdir /app
WORKDIR /app
COPY . .
RUN yarn install
CMD ["UV_THREADPOOL_SIZE=64", "node", "src/index.js"]