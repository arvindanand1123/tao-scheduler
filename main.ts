import { init } from "./init/init.ts";

async function main() {
  await init();
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
