FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip g++ make git
RUN mkdir /app

WORKDIR /app
RUN git clone https://github.com/sandwichfarm/nostr-watch.git 

WORKDIR /app/nostr-watch
# RUN git checkout functional-monitors-pre-nip66-merge
RUN git checkout hotfix/dedupe-relays
RUN yarn install 

WORKDIR /app/nostr-watch/apps/nocapd
ENV UV_THREADPOOL_SIZE=64
CMD ["node", "--trace-warnings",  "--trace-uncaught", "src/index.js"]