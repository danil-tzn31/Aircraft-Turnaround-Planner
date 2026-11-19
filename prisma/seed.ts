import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Category, PrismaClient } from "../src/generated/prisma/client";

const dataDir = join(process.cwd(), "data");

type Row = { cells: Record<string, string>; line: number };

// No quoted fields and no commas inside cells, so a plain split is enough.
function readCsv(file: string, columns: string[]): Row[] {
  const lines = readFileSync(join(dataDir, file), "utf8")
    .split(/\r?\n/)
    .map((l, i) => ({ text: l, line: i + 1 }))
    .filter((l) => l.text.trim() !== "");

  const header = lines[0].text.split(",").map((c) => c.trim());
  if (header.join(",") !== columns.join(",")) {
    throw new Error(`${file} row 1: expected header "${columns.join(",")}", got "${header.join(",")}"`);
  }

  return lines.slice(1).map(({ text, line }) => {
    const parts = text.split(",").map((c) => c.trim());
    if (parts.length !== columns.length) {
      throw new Error(`${file} row ${line}: expected ${columns.length} columns, got ${parts.length}`);
    }
    return { line, cells: Object.fromEntries(columns.map((c, i) => [c, parts[i]])) };
  });
}

function toInt(file: string, row: Row, col: string): number {
  const v = row.cells[col];
  if (!/^\d+$/.test(v)) {
    throw new Error(`${file} row ${row.line}: "${col}" must be a whole number, got "${v}"`);
  }
  return Number(v);
}

function toBool(file: string, row: Row, col: string): boolean {
  const v = row.cells[col];
  if (v !== "true" && v !== "false") {
    throw new Error(`${file} row ${row.line}: "${col}" must be true or false, got "${v}"`);
  }
  return v === "true";
}

const toList = (v: string) => (v === "" ? [] : v.split(";").map((s) => s.trim()));

const validCategories = new Set<string>(Object.values(Category));

function load() {
  const aircraftFile = "aircraft.csv";
  const templateFile = "templates.csv";

  const aircraft = readCsv(aircraftFile, [
    "id", "name", "seats", "two_door_available", "default_two_door",
    "default_ground", "template_version", "source_note",
  ]).map((r) => ({
    id: r.cells.id,
    name: r.cells.name,
    seats: toInt(aircraftFile, r, "seats"),
    twoDoorAvailable: toBool(aircraftFile, r, "two_door_available"),
    defaultTwoDoor: toBool(aircraftFile, r, "default_two_door"),
    defaultGroundMinutes: toInt(aircraftFile, r, "default_ground"),
    templateVersion: toInt(aircraftFile, r, "template_version"),
    sourceNote: r.cells.source_note,
  }));

  const ids = new Set<string>();
  aircraft.forEach((a, i) => {
    if (a.id === "") throw new Error(`${aircraftFile} row ${i + 2}: empty id`);
    if (ids.has(a.id)) throw new Error(`${aircraftFile} row ${i + 2}: duplicate id "${a.id}"`);
    ids.add(a.id);
  });

  const templateRows = readCsv(templateFile, [
    "aircraft", "key", "label", "category", "dur_one_door", "dur_two_door",
    "start_offset", "depends_on", "depends_on_without_fwpob", "sort",
  ]);

  const tasks = templateRows.map((r) => {
    if (!ids.has(r.cells.aircraft)) {
      throw new Error(`${templateFile} row ${r.line}: unknown aircraft "${r.cells.aircraft}"`);
    }
    if (!validCategories.has(r.cells.category)) {
      throw new Error(`${templateFile} row ${r.line}: invalid category "${r.cells.category}"`);
    }
    return {
      line: r.line,
      aircraftTypeId: r.cells.aircraft,
      key: r.cells.key,
      label: r.cells.label,
      category: r.cells.category as Category,
      durationOneDoor: toInt(templateFile, r, "dur_one_door"),
      durationTwoDoor: toInt(templateFile, r, "dur_two_door"),
      startOffset: toInt(templateFile, r, "start_offset"),
      dependsOn: toList(r.cells.depends_on),
      dependsOnWithoutFwpob: toList(r.cells.depends_on_without_fwpob),
      sortOrder: toInt(templateFile, r, "sort"),
    };
  });

  // keys per aircraft, then check deps against them
  const keys = new Map<string, Set<string>>();
  for (const t of tasks) {
    const set = keys.get(t.aircraftTypeId) ?? new Set<string>();
    if (set.has(t.key)) {
      throw new Error(`${templateFile} row ${t.line}: duplicate key "${t.key}" for ${t.aircraftTypeId}`);
    }
    set.add(t.key);
    keys.set(t.aircraftTypeId, set);
  }
  for (const t of tasks) {
    for (const dep of [...t.dependsOn, ...t.dependsOnWithoutFwpob]) {
      if (!keys.get(t.aircraftTypeId)?.has(dep)) {
        throw new Error(
          `${templateFile} row ${t.line}: "${t.key}" depends on "${dep}", which isn't a task of ${t.aircraftTypeId}`,
        );
      }
    }
  }

  return { aircraft, tasks };
}

async function main() {
  const { aircraft, tasks } = load();

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    for (const a of aircraft) {
      const own = tasks.filter((t) => t.aircraftTypeId === a.id);

      await prisma.$transaction(async (tx) => {
        await tx.aircraftType.upsert({ where: { id: a.id }, create: a, update: a });

        for (const { line: _line, ...t } of own) {
          await tx.templateTask.upsert({
            where: { aircraftTypeId_key: { aircraftTypeId: a.id, key: t.key } },
            create: t,
            update: t,
          });
        }

        await tx.templateTask.deleteMany({
          where: { aircraftTypeId: a.id, key: { notIn: own.map((t) => t.key) } },
        });
      });

      console.log(`${a.id}: ${own.length} tasks`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
