const sentinel = Deno.args[0] === 'sentinel';
Deno.serve({ hostname: '::', port: sentinel ? 7778 : 7777 }, (request) => {
  if (sentinel) return new Response('must not be reachable from the mesh');
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return Response.json({ name: 'Isolated FIPS relay fixture', supported_nips: [1, 11] }, {
      headers: { 'content-type': 'application/nostr+json' },
    });
  }
  const { socket, response } = Deno.upgradeWebSocket(request);
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(String(data));
    if (message[0] === 'REQ') socket.send(JSON.stringify(['EOSE', message[1]]));
    if (message[0] === 'EVENT') socket.send(JSON.stringify(['OK', message[1].id, true, 'fixture accepted']));
  };
  return response;
});
