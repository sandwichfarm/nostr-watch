FROM node:14-alpine as build

WORKDIR /app

COPY . /app/

RUN yarn global add yaml-convert

RUN yarn && yarn build

RUN yaml-convert relays.yaml > public/relays.json

RUN yaml-convert cache/geo.yaml > public/geo.json

FROM nginx:stable-alpine as nginx-nostr-relay-registry

COPY ./nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/public /app
COPY --from=build /app/dist /app
