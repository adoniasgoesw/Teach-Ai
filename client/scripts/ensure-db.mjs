import { copyFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const target = resolve(root, "src/data/db.json")
const example = resolve(root, "src/data/db.example.json")

if (!existsSync(target) && existsSync(example)) {
    copyFileSync(example, target)
}
