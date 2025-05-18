/// <reference lib="deno.ns" />

import nostrings from '@nostrwatch/nostrings';

interface Note {
  kind: number;
  content?: string;
  tags?: string[][];
}

export const parseRelayList = (note: Note): string[] => {
  let parsed: string[] = [];

  if (note.kind === 3)
    parsed = parseRelayListFromKind3(note);
  else if (note.kind === 10002)
    parsed = parseRelayListFromKind10002(note);
  else if (note.kind === 30002)
    parsed = parseRelayListFromKind30002(note);
  else if (note.kind === 2)
    parsed = parseRelayFromKind2(note);

  return parsed.length ? nostrings.sanitize.relayUrls(parsed) : [];
};

export const parseRelayFromKind2 = (note: Note): string[] => {
  return note.content ? [note.content] : [];
};

export const parseRelayListFromKind3 = (note: Note): string[] => {
  let dirtyRelayList: string[] = [];
  try {
    if (note.content) {
      dirtyRelayList = Object.keys(JSON.parse(note.content));
    }
  } catch (e) {
    return [];
  }
  return dirtyRelayList.length ? dirtyRelayList : [];
};

export const parseRelayListFromKind10002 = (note: Note): string[] => {
  let dirtyRelayList: string[] = [];
  try {
    dirtyRelayList = note?.tags
      ?.filter(t => t[0] === 'r')
      .map(t => t[1]) || [];
  } catch (e) { }
  return dirtyRelayList;
};

export const parseRelayListFromKind30002 = (note: Note): string[] => {
  let dirtyRelayList: string[] = [];
  try {
    dirtyRelayList = note?.tags
      ?.filter(t => t[0] === 'relay')
      .map(t => t[1]) || [];
  } catch (e) { }
  return dirtyRelayList;
}; 