FROM node:14-alpine as build

WORKDIR /app

COPY index.html main.js package.json webpack.config.js /app/

RUN yarn \
  && npm run build

FROM nginx:stable-alpine as nginx-nostr-relay-registry

COPY ./nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /app