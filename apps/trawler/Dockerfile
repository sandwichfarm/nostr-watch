FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip g++ make
RUN mkdir /app
WORKDIR /app
COPY . .
RUN yarn install --network-timeout 1000000
CMD yarn launch