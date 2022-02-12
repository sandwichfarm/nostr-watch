FROM node:14-alpine as build

WORKDIR /app

COPY index.html main.js package.json build.js /app/

RUN yarn \
  && yarn run build

FROM nginx:stable-alpine as nginx-nostr-relay-registry

COPY ./nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/public /app
