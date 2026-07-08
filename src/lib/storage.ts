import localforage from "localforage";
import type { AppState } from "../types";

export const STORAGE_KEY = "school-consulting-planner-workspace-v1";

localforage.config({
  name: "school-consulting-planner"
});

export async function loadState() {
  return localforage.getItem<AppState>(STORAGE_KEY);
}

export async function saveState(state: AppState) {
  await localforage.setItem(STORAGE_KEY, state);
}
