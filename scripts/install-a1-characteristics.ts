import "dotenv/config";

import { installA1CharacteristicsLesson } from "../src/lib/bundled-lessons/a1-characteristics";

installA1CharacteristicsLesson()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
