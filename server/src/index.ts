import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";

import { readFile } from "node:fs/promises";

import {
  statSync,
  readdirSync,
  createReadStream
} from "node:fs";

import {
  extname,
  join,
  normalize
} from "node:path";

import {
  fileURLToPath
} from "node:url";

import {
  pipeline
} from "node:stream/promises";

import {
  HOST,
  PORT,
  LOG_DIR
} from "./config.js";

import {
  RoomManager
} from "./rooms.js";

import {
  attachWebSocketServer
} from "./ws.js";

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  join(__filename, "..");

const projectRoot =
  join(__dirname, "../..");

const clientDist =
  join(
    projectRoot,
    "client",
    "dist"
  );

const publicDir =
  join(
    projectRoot,
    "public"
  );

const MAX_BODY_SIZE =
  16 * 1024;

async function readJsonBody(
  req: IncomingMessage
): Promise<Record<string, unknown>> {
  let body = "";
  let size = 0;

  for await (const chunk of req) {
    size +=
      Buffer.byteLength(chunk);

    if (
      size > MAX_BODY_SIZE
    ) {
      throw new Error(
        "Request body too large"
      );
    }

    body += chunk;
  }

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error(
      "Invalid JSON"
    );
  }
}

const rooms =
  new RoomManager();

rooms.getOrCreate(
  "alpha",
  "Alpha"
);

rooms.getOrCreate(
  "beta",
  "Beta"
);

const MIME_TYPES: Record<string, string> = {
  ".html":
    "text/html; charset=utf-8",

  ".js":
    "text/javascript; charset=utf-8",

  ".css":
    "text/css; charset=utf-8",

  ".json":
    "application/json; charset=utf-8",

  ".png":
    "image/png",

  ".jpg":
    "image/jpeg",

  ".jpeg":
    "image/jpeg",

  ".webp":
    "image/webp",

  ".svg":
    "image/svg+xml",

  ".mp3":
    "audio/mpeg",

  ".avif":
    "image/avif",
};

function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown
): void {
  const body =
    JSON.stringify(data);

  res.writeHead(
    statusCode,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Content-Length":
        Buffer.byteLength(body),
    }
  );

  res.end(body);
}

async function serveStatic(
  res: ServerResponse,
  pathname: string
): Promise<void> {
  const requestedPath =
    pathname === "/"
      ? "/index.html"
      : pathname;

  const filePath =
    normalize(
      join(
        clientDist,
        requestedPath
      )
    );

  if (
    !filePath.startsWith(
      clientDist
    )
  ) {
    sendJson(
      res,
      403,
      {
        error: "Forbidden"
      }
    );

    return;
  }

  try {
    const stats =
      statSync(
        filePath
      );

    if (
      !stats.isFile()
    ) {
      sendJson(
        res,
        404,
        {
          error: "Not found"
        }
      );

      return;
    }

    const body =
      await readFile(
        filePath
      );

    const contentType =
      MIME_TYPES[
        extname(
          filePath
        ).toLowerCase()
      ] ||
      "application/octet-stream";

    res.writeHead(
      200,
      {
        "Content-Type":
          contentType,

        "Content-Length":
          body.length,
      }
    );

    res.end(body);
  } catch {
    sendJson(
      res,
      404,
      {
        error: "Not found"
      }
    );
  }
}

async function servePublicFile(
  res: ServerResponse,
  pathname: string
): Promise<void> {
  const filePath =
    normalize(
      join(
        publicDir,
        pathname
      )
    );

  if (
    !filePath.startsWith(
      publicDir
    )
  ) {
    sendJson(
      res,
      403,
      {
        error: "Forbidden"
      }
    );

    return;
  }

  try {
    const stats =
      statSync(
        filePath
      );

    if (
      !stats.isFile()
    ) {
      sendJson(
        res,
        404,
        {
          error: "Not found"
        }
      );

      return;
    }

    const body =
      await readFile(
        filePath
      );

    const contentType =
      MIME_TYPES[
        extname(
          filePath
        ).toLowerCase()
      ] ||
      "application/octet-stream";

    res.writeHead(
      200,
      {
        "Content-Type":
          contentType,

        "Content-Length":
          body.length,
      }
    );

    res.end(body);
  } catch {
    sendJson(
      res,
      404,
      {
        error: "Not found"
      }
    );
  }
}

const server =
  createServer(
    async (req, res) => {
      const url =
        new URL(
          req.url || "/",
          `http://${req.headers.host || HOST}`
        );

      // M4: спеціально блокуємо event loop
      // приблизно на 300 мс
      if (
        req.method === "GET" &&
        url.pathname === "/api/slow"
      ) {
        const start =
          Date.now();

        while (
          Date.now() - start < 300
        ) {
          // Навмисне блокування event loop
        }

        sendJson(
          res,
          200,
          {
            ok: true,
            blockedMs:
              Date.now() - start,
          }
        );

        return;
      }

      if (
        req.method === "GET" &&
        url.pathname === "/health"
      ) {
        sendJson(
          res,
          200,
          {
            ok: true,
            service:
              "dogfight-server",
          }
        );

        return;
      }

      if (
        req.method === "GET" &&
        url.pathname === "/api/rooms"
      ) {
        sendJson(
          res,
          200,
          {
            rooms:
              rooms.list(),
          }
        );

        return;
      }

      // M4: статистика server tick
      if (
        req.method === "GET" &&
        /^\/api\/rooms\/[^/]+\/stats$/.test(
          url.pathname
        )
      ) {
        const parts =
          url.pathname.split("/");

        const roomId =
          parts[3];

        if (!roomId) {
          sendJson(
            res,
            400,
            {
              error:
                "Room id is required"
            }
          );

          return;
        }

        const room =
          rooms.get(
            roomId
          );

        if (!room) {
          sendJson(
            res,
            404,
            {
              error:
                "Room not found"
            }
          );

          return;
        }

        sendJson(
          res,
          200,
          {
            roomId:
              room.id,

            tickRate:
              room.match.tickRate,

            bots:
              room.match.bots.size,

            players:
              room.players.size,

            tick:
              room.match.getTickStats(),
          }
        );

        return;
      }

      // M4: додавання AI-ботів у кімнату
      if (
        req.method === "POST" &&
        /^\/api\/rooms\/[^/]+\/bots$/.test(
          url.pathname
        )
      ) {
        try {
          const parts =
            url.pathname.split("/");

          const roomId =
            parts[3];

          if (!roomId) {
            sendJson(
              res,
              400,
              {
                error:
                  "Room id is required"
              }
            );

            return;
          }

          const room =
            rooms.get(
              roomId
            );

          if (!room) {
            sendJson(
              res,
              404,
              {
                error:
                  "Room not found"
              }
            );

            return;
          }

          const body =
            await readJsonBody(
              req
            );

          const rawCount =
            body.count;

          const count =
            rawCount === undefined
              ? 1
              : typeof rawCount === "number"
                ? rawCount
                : NaN;

          if (
            !Number.isInteger(count) ||
            count < 1 ||
            count > 128
          ) {
            sendJson(
              res,
              400,
              {
                error:
                  "Bot count must be an integer from 1 to 128"
              }
            );

            return;
          }

          room.match.addBots(
            count
          );

          sendJson(
            res,
            200,
            {
              ok: true,

              roomId:
                room.id,

              added:
                count,

              bots:
                room.match.bots.size,
            }
          );
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : String(error);

          let status = 400;

          if (
            errorMessage ===
            "Request body too large"
          ) {
            status = 413;
          }

          sendJson(
            res,
            status,
            {
              error:
                errorMessage,
            }
          );
        }

        return;
      }

      // Фон лобі
      if (
        req.method === "GET" &&
        url.pathname ===
          "/api/background.jpg"
      ) {
        await servePublicFile(
          res,
          "/api/background.jpg"
        );

        return;
      }

      // API для скачування/стриминга реплеєв матчів
      if (
        req.method === "GET" &&
        url.pathname.startsWith(
          "/api/replays/"
        )
      ) {
        const roomId =
          url.pathname
            .split("/")
            .pop();

        try {
          const files =
            readdirSync(
              LOG_DIR
            )
              .filter(
                (f) =>
                  f.startsWith(
                    `${roomId}-`
                  ) &&
                  f.endsWith(
                    ".ndjson"
                  )
              )
              .sort();

          if (
            files.length === 0
          ) {
            sendJson(
              res,
              404,
              {
                error:
                  "Replay log not found for this room"
              }
            );

            return;
          }

          const latestFile =
            files.at(-1);

          if (!latestFile) {
            sendJson(
              res,
              404,
              {
                error:
                  "Replay log not found for this room"
              }
            );

            return;
          }

          const latestLogPath =
            join(
              LOG_DIR,
              latestFile
            );

          const stat =
            statSync(
              latestLogPath
            );

          res.writeHead(
            200,
            {
              "Content-Type":
                "application/x-ndjson; charset=utf-8",

              "Content-Length":
                stat.size,

              "Content-Disposition":
                `attachment; filename="${latestFile}"`,
            }
          );

          const readStream =
            createReadStream(
              latestLogPath
            );

          await pipeline(
            readStream,
            res
          );
        } catch (error: unknown) {
          const errorCode =
            typeof error === "object" &&
            error !== null &&
            "code" in error
              ? error.code
              : undefined;

          if (
            errorCode !==
            "ERR_STREAM_PREMATURE_CLOSE"
          ) {
            console.error(
              "Replay streaming error:",
              error
            );

            if (
              !res.headersSent
            ) {
              sendJson(
                res,
                500,
                {
                  error:
                    "Internal server error"
                }
              );
            }
          }
        }

        return;
      }

      if (
        req.method === "POST" &&
        url.pathname === "/api/rooms"
      ) {
        try {
          const body =
            await readJsonBody(
              req
            );

          const id =
            typeof body.id ===
            "string"
              ? body.id.trim()
              : "";

          const name =
            typeof body.name ===
            "string"
              ? body.name.trim()
              : "";

          if (
            !/^[a-zA-Z0-9_-]{1,32}$/.test(
              id
            )
          ) {
            sendJson(
              res,
              400,
              {
                error:
                  "Room id must be 1-32 characters: letters, numbers, _ or -"
              }
            );

            return;
          }

          if (
            name.length < 1 ||
            name.length > 64
          ) {
            sendJson(
              res,
              400,
              {
                error:
                  "Room name must be 1-64 characters"
              }
            );

            return;
          }

          if (
            rooms.get(id)
          ) {
            sendJson(
              res,
              409,
              {
                error:
                  "Room already exists"
              }
            );

            return;
          }

          const room =
            rooms.create(
              id,
              name
            );

          sendJson(
            res,
            201,
            {
              room: {
                id:
                  room.id,

                name:
                  room.name,

                players:
                  room.players.size,
              }
            }
          );
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : String(error);

          let status = 400;

          if (
            errorMessage ===
            "Request body too large"
          ) {
            status = 413;
          }

          if (
            errorMessage ===
            "Server room limit reached"
          ) {
            status = 503;
          }

          sendJson(
            res,
            status,
            {
              error:
                errorMessage,
            }
          );
        }

        return;
      }

      if (
        req.method !== "GET"
      ) {
        sendJson(
          res,
          405,
          {
            error:
              "Method not allowed"
          }
        );

        return;
      }

      await serveStatic(
        res,
        url.pathname
      );
    }
  );

const wss =
  attachWebSocketServer(
    server,
    rooms
  );

server.listen(
  PORT,
  HOST,
  () => {
    console.log(
      `Dogfight server listening on http://${HOST}:${PORT}`
    );
  }
);

function shutdown(
  signal: string
): void {
  console.log(
    `Received ${signal}, shutting down...`
  );

  for (
    const socket of
    wss.clients
  ) {
    socket.close(
      1001,
      "Server shutting down"
    );
  }

  wss.close(
    () => {
      server.close(
        () => {
          console.log(
            "Server stopped."
          );

          process.exit(
            0
          );
        }
      );
    }
  );
}

process.on(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT"
    )
);

process.on(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM"
    )
);
