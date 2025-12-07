import { TodoPage } from "@page-objects/todo-page/todo-page";
import { test as base } from "@playwright/test";

type DefaultFixtures = {
  todoPage: TodoPage;
};

export const test = base.extend<DefaultFixtures>({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    todoPage.navigate();
    await use(todoPage);
  },
});

export { expect } from "@playwright/test";
