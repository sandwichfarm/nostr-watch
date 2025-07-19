FROM node:18-alpine

WORKDIR /app

COPY package.json yarn.lock* ./

RUN yarn install --frozen-lockfile && yarn cache clean

COPY . .

COPY examples/bullmq/.docker.env .env

CMD ["node", "examples/bullmq/index.js"]