import { test } from "@fixtures/default.fixture";

const TODO_ITEMS = [
  "buy some cheese",
  "feed the cat",
  "book a doctors appointment",
] as const;

test.describe("Test group", () => {
  test("seed", async ({ todoPage }) => {
    await test.step("Create 1st todo.", async () => {
      await todoPage.createATodoItem(TODO_ITEMS[0]);
    });

    await test.step("Make sure the list only has one todo item.", async () => {
      await todoPage.checkSavedTodoItems([TODO_ITEMS[0]]);
    });

    await test.step("Create 2nd todo.", async () => {
      await todoPage.createATodoItem(TODO_ITEMS[1]);
    });

    await test.step("Make sure the list now has two todo items.", async () => {
      await todoPage.checkSavedTodoItems([TODO_ITEMS[0], TODO_ITEMS[1]]);
    });

    await todoPage.checkNumberOfTodosInLocalStorage(2);
  });
});
