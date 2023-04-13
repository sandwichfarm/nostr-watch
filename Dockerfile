FROM node:14-alpine as build

WORKDIR /app

COPY . /app/

RUN yarn

RUN yarn build

FROM nginx:stable-alpine as nginx-nostr-relay-registry

COPY ./nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/public /app
COPY --from=build /app/dist /app
