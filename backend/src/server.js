import { app, env } from "./app.js";

app.listen(env.port, () => {
  console.log(`Pathly backend listening on http://localhost:${env.port}`);
});
