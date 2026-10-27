import { finalizeEvent, generateSecretKey } from 'npm:nostr-tools';

const sentinel = Deno.args[0] === 'sentinel';
const url = `ws://${Deno.env.get('FIPS_RELAY_NPUB')}.fips:7777/`;
const advertisement = finalizeEvent({
  kind: 10002, created_at: Math.floor(Date.now() / 1000), content: '',
  tags: [['r', url], ['r', `${url}npub-blocked`], ['r', url.replace('.fips', '.fips.example.com')]],
}, generateSecretKey());
const requests: string[] = [];
Deno.serve({ hostname: '::', port: sentinel ? 7778 : 7777 }, (request) => {
  if (sentinel) return new Response('must not be reachable from the mesh');
  if (new URL(request.url).pathname === '/fixture/requests') return Response.json(requests);
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return Response.json({ name: 'Isolated FIPS relay fixture', supported_nips: [1, 11] }, {
      headers: { 'content-type': 'application/nostr+json' },
    });
  }
  const { socket, response } = Deno.upgradeWebSocket(request);
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(String(data));
    if (message[0] === 'REQ') {
      requests.push(request.url);
      // Only relay-list subscriptions receive the discovery fixture event.
      if (message.slice(2).some((filter: { kinds?: number[] }) => filter.kinds?.includes(10002))) {
        socket.send(JSON.stringify(['EVENT', message[1], advertisement]));
      }
      socket.send(JSON.stringify(['EOSE', message[1]]));
    }
    if (message[0] === 'NEG-OPEN') socket.send(JSON.stringify(['NEG-ERR', message[1], 'unsupported']));
    if (message[0] === 'EVENT') socket.send(JSON.stringify(['OK', message[1].id, true, 'fixture accepted']));
  };
  return response;
});
