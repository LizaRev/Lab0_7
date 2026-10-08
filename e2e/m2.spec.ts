import { test, expect } from "@playwright/test";

type SnapshotEntity = {
  id: string;
  kind: string;
  x: number;
  y: number;
};

type Snapshot = {
  playerShipId: string | null;
  world: {
    entities: SnapshotEntity[];
  };
};

async function joinArena(
  page: import("@playwright/test").Page,
  name: string
): Promise<void> {
  await page.goto("/");

  const nameInput =
    page.getByPlaceholder("Enter your name");

  await expect(nameInput).toBeVisible();

  await nameInput.fill(name);

  const roomButton =
    page.getByRole("button", {
      name: /alpha/i,
    });

  await expect(roomButton).toBeVisible();

  await roomButton.click();

  const joinButton =
    page.getByRole("button", {
      name: /join arena/i,
    });

  await expect(joinButton).toBeEnabled();

  await joinButton.click();

  await expect(
    page.getByText("PLAYERS")
  ).toBeVisible();
}

async function installSnapshotCapture(
  page: import("@playwright/test").Page
): Promise<void> {
  await page.addInitScript(() => {
    const snapshots: unknown[] = [];

    Object.defineProperty(
      window,
      "__dogfightSnapshots",
      {
        value: snapshots,
        writable: false,
        configurable: false,
      }
    );

    const originalDispatchEvent =
      EventTarget.prototype.dispatchEvent;

    EventTarget.prototype.dispatchEvent =
      function (
        event: Event
      ): boolean {
        if (
          event.type === "snapshot" &&
          event instanceof CustomEvent
        ) {
          snapshots.push(event.detail);
        }

        return originalDispatchEvent.call(
          this,
          event
        );
      };
  });
}

async function getSnapshots(
  page: import("@playwright/test").Page
): Promise<Snapshot[]> {
  return page.evaluate(() => {
    const value =
      (
        window as unknown as {
          __dogfightSnapshots?: unknown[];
        }
      ).__dogfightSnapshots;

    if (!Array.isArray(value)) {
      return [];
    }

    return value as Snapshot[];
  });
}

function getShipPosition(
  snapshot: Snapshot,
  shipId: string
): { x: number; y: number } | null {
  const ship =
    snapshot.world.entities.find(
      (entity) =>
        entity.kind === "ship" &&
        entity.id === shipId
    );

  if (!ship) {
    return null;
  }

  return {
    x: ship.x,
    y: ship.y,
  };
}

async function waitForSnapshot(
  page: import("@playwright/test").Page,
  predicate: (
    snapshot: Snapshot
  ) => boolean = () => true
): Promise<Snapshot> {
  await expect
    .poll(
      async () => {
        const snapshots =
          await getSnapshots(page);

        return snapshots.find(
          predicate
        );
      },
      {
        timeout: 5_000,
        intervals: [
          50,
          100,
          200,
        ],
      }
    )
    .toBeTruthy();

  const snapshots =
    await getSnapshots(page);

  const snapshot =
    snapshots.find(
      predicate
    );

  if (!snapshot) {
    throw new Error(
      "Snapshot was not received"
    );
  }

  return snapshot;
}

test.describe("Lab 7 M2 E2E", () => {
  test("two players join the same room and see each other", async ({
    browser,
  }) => {
    const context1 =
      await browser.newContext();

    const context2 =
      await browser.newContext();

    const page1 =
      await context1.newPage();

    const page2 =
      await context2.newPage();

    try {
      await joinArena(
        page1,
        "Alice"
      );

      await joinArena(
        page2,
        "Bob"
      );

      await expect(
        page1.getByText("Alice", {
          exact: true,
        })
      ).toBeVisible();

      await expect(
        page1.getByText("Bob", {
          exact: true,
        })
      ).toBeVisible();

      await expect(
        page2.getByText("Alice", {
          exact: true,
        })
      ).toBeVisible();

      await expect(
        page2.getByText("Bob", {
          exact: true,
        })
      ).toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("chat message is received by the second player", async ({
    browser,
  }) => {
    const context1 =
      await browser.newContext();

    const context2 =
      await browser.newContext();

    const page1 =
      await context1.newPage();

    const page2 =
      await context2.newPage();

    try {
      await joinArena(
        page1,
        "Alice"
      );

      await joinArena(
        page2,
        "Bob"
      );

      const chatInput =
        page1.getByPlaceholder(
          "Message..."
        );

      await expect(
        chatInput
      ).toBeVisible();

      await chatInput.fill(
        "Hello Bob"
      );

      await page1
        .getByRole("button", {
          name: "Send",
          exact: true,
        })
        .click();

      await expect(
        page2.getByText(
          "Hello Bob",
          {
            exact: true,
          }
        )
      ).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("movement is visible to the other player", async ({
    browser,
  }) => {
    const context1 =
      await browser.newContext();

    const context2 =
      await browser.newContext();

    const page1 =
      await context1.newPage();

    const page2 =
      await context2.newPage();

    try {
      await installSnapshotCapture(
        page1
      );

      await installSnapshotCapture(
        page2
      );

      await joinArena(
        page1,
        "Alice"
      );

      await joinArena(
        page2,
        "Bob"
      );

      const aliceSnapshot =
        await waitForSnapshot(
          page1,
          (snapshot) =>
            snapshot.playerShipId !==
            null
        );

      const aliceShipId =
        aliceSnapshot.playerShipId;

      if (!aliceShipId) {
        throw new Error(
          "Alice ship ID was not received"
        );
      }

      const initialSnapshot =
        await waitForSnapshot(
          page2,
          (snapshot) =>
            getShipPosition(
              snapshot,
              aliceShipId
            ) !== null
        );

      const initialPosition =
        getShipPosition(
          initialSnapshot,
          aliceShipId
        );

      if (!initialPosition) {
        throw new Error(
          "Alice ship was not visible to Bob"
        );
      }

      await page1.keyboard.down(
        "ArrowUp"
      );

      await page1.waitForTimeout(
        700
      );

      await page1.keyboard.up(
        "ArrowUp"
      );

      const movedSnapshot =
        await waitForSnapshot(
          page2,
          (snapshot) => {
            const position =
              getShipPosition(
                snapshot,
                aliceShipId
              );

            if (!position) {
              return false;
            }

            const dx =
              position.x -
              initialPosition.x;

            const dy =
              position.y -
              initialPosition.y;

            const distance =
              Math.sqrt(
                dx * dx +
                dy * dy
              );

            return distance > 5;
          }
        );

      const movedPosition =
        getShipPosition(
          movedSnapshot,
          aliceShipId
        );

      if (!movedPosition) {
        throw new Error(
          "Moved Alice ship was not found"
        );
      }

      const dx =
        movedPosition.x -
        initialPosition.x;

      const dy =
        movedPosition.y -
        initialPosition.y;

      const distance =
        Math.sqrt(
          dx * dx +
          dy * dy
        );

      expect(
        distance
      ).toBeGreaterThan(5);
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
