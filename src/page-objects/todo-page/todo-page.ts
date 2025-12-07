import { expect, Locator, Page } from "@playwright/test";

export class TodoPage {
  private page: Page;
  private todoEntryField: Locator;
  private todoItems: Locator;
  private toggleAllCheckbox: Locator;
  private todoCount: Locator;
  private clearCompletedButton: Locator;
  private allFilter: Locator;
  private activeFilter: Locator;
  private completedFilter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.todoEntryField = this.page.getByPlaceholder("What needs to be done?");
    this.todoItems = this.page.getByTestId("todo-item");
    this.toggleAllCheckbox = this.page.getByLabel("Mark all as complete");
    this.todoCount = this.page.getByTestId("todo-count");
    this.clearCompletedButton = this.page.getByRole("button", {
      name: "Clear completed",
    });
    this.allFilter = this.page.getByRole("link", { name: "All" });
    this.activeFilter = this.page.getByRole("link", { name: "Active" });
    this.completedFilter = this.page.getByRole("link", { name: "Completed" });
  }

  async navigate() {
    await this.page.goto("https://demo.playwright.dev/todomvc");
  }

  async createATodoItem(todoItemName: string) {
    await this.todoEntryField.fill(todoItemName);
    await this.todoEntryField.press("Enter");
  }

  async checkSavedTodoItems(todoItemName: readonly string[]) {
    await expect(this.todoItems).toHaveCount(todoItemName.length);
    await expect(this.todoItems).toHaveText([...todoItemName]);
  }

  async verifyTodoInputEmpty() {
    await expect(this.todoEntryField).toBeEmpty();
  }

  async createDefaultTodos(items: readonly string[]) {
    for (const item of items) {
      await this.createATodoItem(item);
    }
  }

  async verifyTodoCount(count: number) {
    await expect(this.todoCount).toContainText(`${count}`);
  }

  async markAllAsComplete() {
    await this.toggleAllCheckbox.check();
  }

  async unMarkAllAsComplete() {
    await this.toggleAllCheckbox.uncheck();
  }

  async verifyAllTodosCompleted() {
    await expect(this.todoItems).toHaveClass([
      "completed",
      "completed",
      "completed",
    ]);
  }

  async verifyNoTodosCompleted() {
    await expect(this.todoItems).toHaveClass(["", "", ""]);
  }

  async toggleTodoItem(index: number) {
    const todo = this.todoItems.nth(index);
    await todo.getByRole("checkbox").check();
  }

  async unToggleTodoItem(index: number) {
    const todo = this.todoItems.nth(index);
    await todo.getByRole("checkbox").uncheck();
  }

  async verifyTodoItemCompleted(index: number) {
    const todo = this.todoItems.nth(index);
    await expect(todo).toHaveClass("completed");
  }

  async verifyTodoItemNotCompleted(index: number) {
    const todo = this.todoItems.nth(index);
    await expect(todo).not.toHaveClass("completed");
  }

  async verifyToggleAllChecked() {
    await expect(this.toggleAllCheckbox).toBeChecked();
  }

  async verifyToggleAllNotChecked() {
    await expect(this.toggleAllCheckbox).not.toBeChecked();
  }

  async editTodoItem(index: number, newText: string) {
    const todo = this.todoItems.nth(index);
    await todo.dblclick();
    await todo.getByRole("textbox", { name: "Edit" }).fill(newText);
    await todo.getByRole("textbox", { name: "Edit" }).press("Enter");
  }

  async verifyEditMode(index: number, newText: string) {
    const todo = this.todoItems.nth(index);
    await todo.dblclick();
    await expect(todo.getByRole("checkbox")).not.toBeVisible();
    await expect(
      todo.locator("label", {
        hasText: newText,
      })
    ).not.toBeVisible();
  }

  async editTodoItemAndBlur(index: number, newText: string) {
    const todo = this.todoItems.nth(index);
    await todo.dblclick();
    await todo.getByRole("textbox", { name: "Edit" }).fill(newText);
    await todo.getByRole("textbox", { name: "Edit" }).dispatchEvent("blur");
  }

  async cancelEdit(index: number, newText: string) {
    const todo = this.todoItems.nth(index);
    await todo.dblclick();
    await todo.getByRole("textbox", { name: "Edit" }).fill(newText);
    await todo.getByRole("textbox", { name: "Edit" }).press("Escape");
  }

  async clearCompleted() {
    await this.clearCompletedButton.click();
  }

  async verifyClearCompletedVisible() {
    await expect(this.clearCompletedButton).toBeVisible();
  }

  async verifyClearCompletedHidden() {
    await expect(this.clearCompletedButton).toBeHidden();
  }

  async filterAll() {
    await this.allFilter.click();
  }

  async filterActive() {
    await this.activeFilter.click();
  }

  async filterCompleted() {
    await this.completedFilter.click();
  }

  async verifyFilterSelected(filterName: string) {
    await expect(this.page.getByRole("link", { name: filterName })).toHaveClass(
      "selected"
    );
  }

  async verifyFilterNotSelected(filterName: string) {
    await expect(
      this.page.getByRole("link", { name: filterName })
    ).not.toHaveClass("selected");
  }

  async checkNumberOfTodosInLocalStorage(expected: number) {
    return await this.page.waitForFunction((e) => {
      return JSON.parse(localStorage["react-todos"]).length === e;
    }, expected);
  }

  async checkNumberOfCompletedTodosInLocalStorage(expected: number) {
    return await this.page.waitForFunction((e) => {
      return (
        JSON.parse(localStorage["react-todos"]).filter(
          (todo: any) => todo.completed
        ).length === e
      );
    }, expected);
  }

  async checkTodosInLocalStorage(title: string) {
    return await this.page.waitForFunction((t) => {
      return JSON.parse(localStorage["react-todos"])
        .map((todo: any) => todo.title)
        .includes(t);
    }, title);
  }
}
