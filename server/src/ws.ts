import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { RawData } from "ws";

import {
  MESSAGE_TYPES,
  PROTOCOL_VERSION,
  parseClientMessage,
} from "./protocol.js";

import type {
  Message,
  ClientMessage,
  InputMessage,
} from "../../shared/protocol/messages.js";

import type {
  Room,
  RoomManager,
} from "./rooms.js";

import {
  encodeBinaryMessage,
  decodeBinaryMessage,
} from "../../shared/protocol/binary.js";

import { TokenBucket } from "./rate-limit.js";

const JOIN_TIMEOUT_MS = 5_000;
const HEARTBEAT_MS = 15_000;
const MAX_MISSED_PONGS = 2;

const MAX_BUFFERED_AMOUNT = 64 * 1024;

const USE_BINARY_PROTOCOL =
  process.env.BINARY_PROTOCOL === "true";

const TOKEN_BUCKET_CAPACITY = 120;
const TOKEN_REFILL_RATE = 60;

type Player = {
  id: string;
  name: string;
  room: Room | null;
  send: (
    message: unknown,
    isCritical?: boolean
  ) => boolean;
};

type BinaryMessage = Extract<
  Message,
  {
    type:
      | typeof MESSAGE_TYPES.INPUT
      | typeof MESSAGE_TYPES.SNAPSHOT;
  }
>;

export function attachWebSocketServer(
  server: HttpServer,
  roomManager: RoomManager
): WebSocketServer {
  const wss =
    new WebSocketServer({
      noServer: true,
      maxPayload: 64 * 1024,
    });

  server.on(
    "upgrade",
    (
      request,
      socket,
      head
    ) => {
      const url =
        new URL(
          request.url || "/",
          `http://${request.headers.host || "localhost"}`
        );

      if (
        url.pathname !== "/ws"
      ) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(
        request,
        socket,
        head,
        (ws) => {
          wss.emit(
            "connection",
            ws,
            request
          );
        }
      );
    }
  );

  wss.on(
    "connection",
    (rawSocket) => {
      const player: Player = {
        id: randomUUID(),
        name: "Guest",
        room: null,
        send: () => false,
      };

      const socket =
        Object.assign(
          rawSocket,
          {
            player,
            room: null as Room | null,
          }
        );

      let joined = false;
      let missedPongs = 0;

      const rateLimiter =
        new TokenBucket(
          TOKEN_BUCKET_CAPACITY,
          TOKEN_REFILL_RATE
        );

      const send = (
        message: unknown,
        isCritical = true
      ): boolean => {
        if (
          socket.readyState !==
          WebSocket.OPEN
        ) {
          return false;
        }

        if (
          socket.bufferedAmount >
          MAX_BUFFERED_AMOUNT
        ) {
          if (!isCritical) {
            return false;
          }

          console.warn(
            `Terminating slow client ${player.id}: ` +
            `buffer overflow (${socket.bufferedAmount} bytes)`
          );

          socket.close(
            1008,
            "Slow client: buffer overflow"
          );

          return false;
        }

        const useBinary =
          USE_BINARY_PROTOCOL &&
          isBinaryMessage(message);

        socket.send(
          useBinary
            ? encodeBinaryMessage(message)
            : JSON.stringify(message)
        );

        return true;
      };

      player.send = send;

      const sendError = (
        error: string
      ): void => {
        send(
          {
            version:
              PROTOCOL_VERSION,

            type:
              MESSAGE_TYPES.ERROR,

            error,
          },
          true
        );
      };

      const joinTimeout =
        setTimeout(
          () => {
            if (!joined) {
              sendError(
                "Join required within 5 seconds"
              );

              socket.close(
                1008,
                "Join timeout"
              );
            }
          },
          JOIN_TIMEOUT_MS
        );

      const heartbeat =
        setInterval(
          () => {
            if (
              socket.readyState !==
              WebSocket.OPEN
            ) {
              return;
            }

            if (
              missedPongs >=
              MAX_MISSED_PONGS
            ) {
              console.log(
                `Terminating inactive socket ${player.id}`
              );

              socket.terminate();

              return;
            }

            missedPongs += 1;

            socket.ping();
          },
          HEARTBEAT_MS
        );

      socket.on(
        "pong",
        () => {
          missedPongs = 0;
        }
      );

      socket.on(
        "message",
        (
          raw: RawData,
          isBinary: boolean
        ) => {
          if (
            !rateLimiter.check()
          ) {
            console.warn(
              `Rate limit exceeded for player ${player.id}`
            );

            sendError(
              "Rate limit exceeded"
            );

            socket.close(
              1008,
              "Rate limit exceeded"
            );

            return;
          }

          let message: unknown;

          try {
            message = isBinary
              ? decodeBinaryMessage(
                  rawToArrayBuffer(raw)
                )
              : JSON.parse(
                  raw.toString()
                );
          } catch {
            sendError(
              isBinary
                ? "Invalid binary message"
                : "Invalid JSON"
            );

            socket.close(
              1007,
              "Invalid JSON"
            );

            return;
          }

          const result =
            parseClientMessage(
              message
            );

          if (!result.ok) {
            console.warn(
              `Invalid WebSocket message ` +
              `from ${player.id}: ${result.error}`
            );

            sendError(
              result.error
            );

            socket.close(
              1008,
              "Invalid message"
            );

            return;
          }

          handleMessage(
            result.message
          );
        }
      );

      socket.on(
        "close",
        () => {
          clearTimeout(
            joinTimeout
          );

          clearInterval(
            heartbeat
          );

          if (socket.room) {
            const room =
              socket.room;

            room.removePlayer(
              player.id
            );

            room.broadcast(
              {
                version:
                  PROTOCOL_VERSION,

                type:
                  MESSAGE_TYPES.ROSTER,

                roomId:
                  room.id,

                players:
                  room.roster(),
              },
              null,
              true
            );

            socket.room = null;
            player.room = null;
          }
        }
      );

      socket.on(
        "error",
        (error: Error) => {
          console.error(
            `WebSocket error for ${player.id}:`,
            error.message
          );
        }
      );

      function handleMessage(
        message: ClientMessage
      ): void {
        switch (message.type) {
          case MESSAGE_TYPES.PING:
            handlePing();
            break;

          case MESSAGE_TYPES.JOIN:
            joinRoom(message);
            break;

          case MESSAGE_TYPES.LEAVE:
            leaveRoom();
            break;

          case MESSAGE_TYPES.CHAT:
            chat(message);
            break;

          case MESSAGE_TYPES.INPUT:
            handleInput(message);
            break;

          default: {
            const neverMessage: never =
              message;

            sendError(
              `Unsupported message type: ` +
              String(neverMessage)
            );
          }
        }
      }

      function handlePing(): void {
        send(
          {
            version:
              PROTOCOL_VERSION,

            type:
              MESSAGE_TYPES.PONG,
          },
          true
        );
      }

      function joinRoom(
        message: Extract<
          ClientMessage,
          {
            type:
              typeof MESSAGE_TYPES.JOIN;
          }
        >
      ): void {
        const roomId =
          message.roomId.trim();

        const name =
          message.name.trim()
            ? message.name
                .trim()
                .slice(0, 24)
            : "Guest";

        if (!roomId) {
          sendError(
            "roomId is required"
          );

          return;
        }

        const room =
          roomManager.get(
            roomId
          );

        if (!room) {
          sendError(
            "Room not found"
          );

          return;
        }

        if (socket.room) {
          leaveRoom();
        }

        player.name = name;
        player.room = room;
        socket.room = room;

        joined = true;

        clearTimeout(
          joinTimeout
        );

        try {
          room.addPlayer(
            player
          );
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : String(error);

          sendError(
            errorMessage
          );

          socket.close(
            1008,
            errorMessage
          );

          return;
        }

        room.emit(
          "chat",
          {
            roomId:
              room.id,

            player,

            text:
              `${player.name} joined the room`,
          }
        );

        broadcastRoster(
          room
        );
      }

      function handleInput(
        message: InputMessage
      ): void {
        if (!socket.room) {
          sendError(
            "Join a room first"
          );

          return;
        }

        const room =
          socket.room;

        if (!room.match) {
          sendError(
            "Match is not available"
          );

          return;
        }

        room.match.setInput(
          player.id,
          message.seq,
          message.input
        );
      }

      function leaveRoom(): void {
        const room =
          socket.room;

        if (!room) {
          return;
        }

        room.removePlayer(
          player.id
        );

        socket.room = null;
        player.room = null;

        broadcastRoster(
          room
        );
      }

      function chat(
        message: Extract<
          ClientMessage,
          {
            type:
              typeof MESSAGE_TYPES.CHAT;
          }
        >
      ): void {
        const room =
          socket.room;

        if (!room) {
          sendError(
            "Join a room first"
          );

          return;
        }

        const text =
          message.text
            .trim()
            .slice(0, 500);

        if (!text) {
          sendError(
            "Chat text is required"
          );

          return;
        }

        room.emit(
          "log-event",
          {
            type:
              "chat",

            playerId:
              player.id,

            name:
              player.name,

            text,
          }
        );

        room.emit(
          "chat",
          {
            roomId:
              room.id,

            player,

            text,
          }
        );

        room.broadcast(
          {
            version:
              PROTOCOL_VERSION,

            type:
              MESSAGE_TYPES.CHAT,

            roomId:
              room.id,

            playerId:
              player.id,

            name:
              player.name,

            text,
          },
          null,
          false
        );
      }

      function broadcastRoster(
        room: Room
      ): void {
        room.broadcast(
          {
            version:
              PROTOCOL_VERSION,

            type:
              MESSAGE_TYPES.ROSTER,

            roomId:
              room.id,

            players:
              room.roster(),
          },
          null,
          true
        );
      }
    }
  );

  return wss;
}

function isBinaryMessage(
  message: unknown
): message is BinaryMessage {
  if (
    typeof message !== "object" ||
    message === null ||
    !("type" in message)
  ) {
    return false;
  }

  return (
    message.type ===
      MESSAGE_TYPES.INPUT ||
    message.type ===
      MESSAGE_TYPES.SNAPSHOT
  );
}

function rawToArrayBuffer(
  raw: RawData
): ArrayBuffer | Uint8Array {
  if (
    raw instanceof ArrayBuffer
  ) {
    return raw;
  }

  if (
    Array.isArray(raw)
  ) {
    return Buffer.concat(
      raw
    );
  }

  return raw;
}
