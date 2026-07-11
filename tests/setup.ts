import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock next/cache so server actions don't blow up outside Next.js
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Default DATABASE_PATH to in-memory SQLite for all tests
process.env.DATABASE_PATH = ":memory:";
