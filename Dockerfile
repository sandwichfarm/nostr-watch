FROM node:14-alpine as build

WORKDIR /app

COPY . /app/

RUN yarn && yarn build

RUN yarn global add yaml2json yaml-doctor 

RUN yaml-doctor relays.yaml --fix

RUN echo $(cat relays.yaml)

RUN yaml2json relays.yaml > dist/relays.json

FROM nginx:stable-alpine as nginx-nostr-relay-registry

COPY ./nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/public /app
COPY --from=build /app/dist /app
